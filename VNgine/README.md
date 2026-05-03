# VNgine

Browser-first visual novel editor and engine MVP.

## Scripts

```powershell
npm.cmd install
npm.cmd run dev:editor
npm.cmd run dev:engine
npm.cmd run build
npm.cmd test
```

## Structure

- `Editor`: authoring app
- `Engine`: player/runtime app
- `Shared`: schemas, validation, import/export, runtime helpers
- `Resource`: default local testing resource folder
