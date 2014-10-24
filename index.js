/**
 * Creates global define function to mimic requirejs define in node
 */

var defineFactory = require('rendr-amdefine');

var basePath, originalRequireJS;

// add define function to the module prototype
if (!module.constructor.prototype.define)
{
  // create module specific define function
  module.constructor.prototype.define = function(id, deps, initializer)
  {
    var moduleDefine = defineFactory(this);
    return moduleDefine(id, deps, initializer);
  }

  // hijack .js handler to add module specific define function to global namespace
  originalRequireJS = require.extensions['.js'];
  require.extensions['.js'] = function customRequireHandler(module, filename)
  {
    global.define = module.define.bind(module);
    return originalRequireJS(module, filename);
  }
}

// export API function to update basePath
module.exports = function(options)
{
  basePath = options.path;
  defineFactory.withExtras(['tests']).basePath(options.path);
}
