/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING')
    self.skipWaiting()
})

clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

cleanupOutdatedCaches()

/** @type {RegExp[] | undefined} */
let allowlist
if (import.meta.env.DEV)
  allowlist = [/^\/$/]

registerRoute(new NavigationRoute(
  createHandlerBoundToURL('index.html'),
  { allowlist },
))
