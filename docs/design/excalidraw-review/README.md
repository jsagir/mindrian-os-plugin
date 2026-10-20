# Opportunity Scout architecture review

A local Excalidraw review app for `../opportunity-scout-architecture.excalidraw`.
It serves only on `127.0.0.1:4175`; the source diagram and draft edits stay on this computer.

## Start

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:4175/>. Use Excalidraw tools to add comments or edit shapes. **Save review copy** downloads an editable `.excalidraw` snapshot and keeps a draft in this browser's local storage. **Reset to original** clears that browser draft.

To use another drawing as the starting point, replace `public/architecture.excalidraw` and reload after selecting **Reset to original**.
