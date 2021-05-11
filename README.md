# service-worker-checker
galatadergisi.org uses a service worker to cache js and css. This actions check if the cache name of the service worker needs to change.

It will compare the SHA sums of the generated bundles of the main branch and the website. If there is a difference then the service worker
cache name must be updated. Otherwise clients would continue to use old bundles.
