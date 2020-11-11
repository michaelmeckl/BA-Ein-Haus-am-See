//@ts-nocheck
/* eslint-disable */

/*
console.defaultLog = console.log.bind(console);
console.logs = [];
console.log = function () {
  // default &  console.log()
  console.defaultLog.apply(console, arguments);
  // new & array data
  console.logs.push(Array.from(arguments));
};

console.defaultError = console.error.bind(console);
console.errors = [];
console.error = function () {
  // default &  console.error()
  console.defaultError.apply(console, arguments);
  // new & array data
  console.errors.push(Array.from(arguments));
};

console.defaultWarn = console.warn.bind(console);
console.warns = [];
console.warn = function () {
  // default &  console.warn()
  console.defaultWarn.apply(console, arguments);
  // new & array data
  console.warns.push(Array.from(arguments));
};

export function getLogs(): any {
  return [...console.logs, ...console.errors, ...console.warns];
}

export function clearLogs(): any {
  console.logs.length = 0;
  console.errors.length = 0;
  console.warns.length = 0;
}
*/
