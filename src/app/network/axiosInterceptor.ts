import axios from "axios";

// code taken from https://gist.github.com/matthewsuan/2bdc9e7f459d5b073d58d1ebc0613169
// only allow 7 concurrent requests
const MAX_REQUESTS_COUNT = 7;
const INTERVAL_MS = 10;
let PENDING_REQUESTS = 0;

// create new axios instance
const customAxios = axios.create({});

/**
 * Axios Request Interceptor
 */
customAxios.interceptors.request.use(function (config) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) {
        PENDING_REQUESTS++;
        clearInterval(interval);
        resolve(config);
      }
    }, INTERVAL_MS);
  });
});

/**
 * Axios Response Interceptor
 */
customAxios.interceptors.response.use(
  function (response) {
    PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
    return Promise.resolve(response);
  },
  function (error) {
    PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
    return Promise.reject(error);
  }
);

export default customAxios;
