# requirejs-define

Creates global define function to mimic requirejs define in node.
Using [AMDefine](https://npmjs.org/package/amdefine) under the hood.

## Example

`index.js`:

```javascript
require('requirejs-define')({path: __dirname});
```

`module.js`:

```javascript
// works both in node and on the client
define([
  'app/models/property',
  'app/collections/property_search'
], function(Property, PropertySearch)
{
  // ...
});
```
