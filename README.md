# Global Define

AMD loader for Node, it creates global define function to mimic requirejs define in node.
Using [amdefine](http://npmjs.org/package/amdefine) under the hood.
And allows to require modules relative to `basePath` (*escaping `../../../../..` mess*).
Combined with support for `paths` aliases, provides unified environment for modules shared between server and browser (isomorphic javascript).

## Installiation

```
npm install global-define --save
```

## Examples

### Basic

Include following line within entry point of your application, and it will automatically add global define function to all included modules/files.

`index.js`:

```javascript
require('global-define')({basePath: __dirname});
```

`module.js`:

```javascript
// works in node and in a browser
define([
  'app/models/property',
  'app/collections/property_search'
], function(Property, PropertySearch)
{
  // ...
});
```

### Path aliases

Usually its suggested for module id to reflect path to the file,
but its not always the case, this is where paths aliases come to help.

In the following example `some_module` has several components
located within `lib` folder.

`index.js`:

```javascript
require('global-define')(
{
  basePath: __dirname,
  paths:
  {
    'some_module/': 'some_module/lib/'
  }
});
```

`node_modules/some_module/lib/component.js`:

```javascript

define('some_module/component', [
  'some_module/another_component'
], function(Dependency)
{
  // ...
});
```

### Black List

If certain modules don't play nice with global define on the server,
its possible to exclude them from the world of happiness,
by adding them to the black list. It supports glob patterns via [minimatch](http://npmjs.org/package/minimatch) module.

Following example will add global define only to the files of the project,
without affecting any dependencies.

`index.js`:

```javascript
require('global-define')(
{
  basePath:  __dirname,
  blackList: ['node_modules/**']
});
```

### White List

If you want to play safe, you can white list only certain files in the project.

Following example will add global define only to the files in `app/shared` folder.

`index.js`:

```javascript
require('global-define')(
{
  basePath:  __dirname,
  whiteList: ['app/shared/**']
});
```

### Expose AMDefine

By default it creates only global `define` function, so UMD modules still opt-in for server-side way of doing things (some of them are using UMD not only for loading resources, but to choose between browser/server branches of the code).

If you don't have such modules (or blacklisted them) and you need better `requirejs`/`amdefine` support,
set `exposeAmdefine` to true, to expose `.amd` and `.require` properties of the amdefine module
on per file basis.

`index.js`:

```javascript
require('global-define')(
{
  basePath:  __dirname,
  blackList: ['node_modules/sinon/'],
  exposeAmdefine: true
});
```

### Same file invocation

If you want to use `global-define` within tne entry point of your application (*your index file*). It returns reference to the `define` function tailored for the invoking module:

`index.js`:

```javascript
var define = require('global-define')({basePath: __dirname});

define(['app/lib/helper'], function(Helper)
{
  // ...
});
```
