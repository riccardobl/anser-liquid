/**
 * A fetch that at some point gets tired.
 */

function fetchWithTimeout(url, options, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), timeout);
    })
  ]);
}

export default fetchWithTimeout;
