import * as FS from "fs"
import * as PATH from "path"
import { Logger } from "./Logger"

export class LocalStorageManager {

  private logger: Logger = new Logger('LocalStorageManager')
  private DataCache: {
    [scope: string]: {
      [key: string]: any
    }
  } = {}
  private saveTimer: {
    [scope: string]: NodeJS.Timeout | null
  } = {}
  private StorageDirPath: string = PATH.join(__dirname, '../storage')

  constructor() {
    try {
      const stat = FS.statSync(this.StorageDirPath)
      if (!stat.isDirectory()) {
        throw new Error(`'${this.StorageDirPath}' is not a directory`)
      }
    } catch (e) {
      if (e.errno === -2) {
        FS.mkdirSync(this.StorageDirPath)
      } else {
        throw e
      }
    }
    const scopes = FS.readdirSync(this.StorageDirPath)
    for (let scope of scopes) {
      const scopePath = PATH.join(this.StorageDirPath, scope)
      const dataString = FS.readFileSync(scopePath)
      try {
        this.DataCache[scope] = JSON.parse(dataString.toString())
      } catch (e) {
        throw new Error(`持久化储存文件格式化失败: ${scopePath}\n请检查该文件修复或手动删除`)
      }
    }
  }

  private save(scope: string) {
    if (!this.saveTimer[scope]) {
      this.saveTimer[scope] = setTimeout(() => {
        this.saveTimer[scope] = null
        FS.writeFileSync(PATH.join(this.StorageDirPath, scope), JSON.stringify(this.DataCache[scope], null, 2))
      }, 5000)
    }
  }

  public set(scope: string, key: string, value: any): void {
    if (!this.DataCache[scope]) {
      this.DataCache[scope] = {}
    }
    this.DataCache[scope][key] = value
    this.save(scope)
  }

  public get<T>(scope: string, key: string): T | undefined
  public get<T>(scope: string, key: string, defaultValue: T, saveDefaultValue: boolean): T
  public get<T>(scope: string, key: string, defaultValue?: T, saveDefaultValue?: boolean): T | undefined {
    if (!this.DataCache[scope]) {
      this.DataCache[scope] = {}
    }
    if (this.DataCache[scope][key] === undefined) {
      if (defaultValue !== undefined && saveDefaultValue) {
        this.set(scope, key, defaultValue)
      }
      return defaultValue
    } else {
      return this.DataCache[scope][key]
    }
  }
}