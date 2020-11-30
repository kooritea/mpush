export const Throttle = (time: number, getKey?: (...args: any[]) => string) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const origin = descriptor.value
    const timerStore: {
      [key: string]: NodeJS.Timeout
    } = {}
    descriptor.value = function (...args: any[]) {
      const timerStoreKey = typeof getKey === 'function' ? getKey(...args) : 'default'
      if (!timerStore[timerStoreKey]) {
        timerStore[timerStoreKey] = setTimeout(() => {
          delete timerStore[timerStoreKey]
          origin.call(this, ...args)
        }, time)
      }
    }
  }
};