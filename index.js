/**
 * Creates global define function to mimic requirejs define in node
 */

var basePath
  , paths
  , originalRequireJS
  , fs       = require('fs')
  , path     = require('path')
  , amdefine = require('amdefine')
  ;

// add global define function
if (require.extensions['.js']._id != module.id)
{
  // hijack .js handler to add module specific define function to global namespace
  originalRequireJS = require.extensions['.js'];
  require.extensions['.js'] = function customRequireHandler(requiredModule, filename)
  {
    // create global define specific to the module
    global.define = amdefineWorkaround(requiredModule);

    return originalRequireJS(requiredModule, filename);
  }

  // mark the thing
  require.extensions['.js']._id = module.id;
}

// export API function to update basePath
module.exports = function(options)
{
  basePath = options.basePath || process.cwd();
  paths    = options.paths || {};
}

// create workaround for amdefine
// to treat all the module equally
// (by default it doesn't execute modules with ids)
function amdefineWorkaround(requiredModule)
{
  // prepare define function
  var define = amdefine(requiredModule, pretendRequire(requiredModule));

  // return wrapper
  function wrapper(id, deps, initializer)
  {
    // init module
    define(id, deps, initializer);

    // if module provides id
    // force it to be executed anyway
    if (typeof id == 'string')
    {
      requiredModule.exports = define.require(id);
    }
  }

  // make it look like legit thing
  wrapper.amd = define.amd;
  wrapper.require = define.require;

  return wrapper;
}

// check for requested path, if it has "/"" in the path
// and doesn't start with "." or "/"
// treat it as path relative to the project's root
// and replace it with absolute path
function pretendRequire(baseModule)
{
  return function pretendRequire_require(moduleId)
  {

    var componentPath
        // translate module to path alias
      , modulePath = checkPath(moduleId)
        // get first part of the module path
      , component = (modulePath || '').split('/')[0]
      ;

    // check if name and path belong to the app or to node_modules
    if (component && component[0] != '.')
    {
      componentPath = path.resolve(basePath, component);

      if (fs.existsSync(componentPath))
      {
        // everything fits nicely, get the full thing
        // file might not exist at this point
        // but its legit developer's error
        modulePath = path.resolve(basePath, modulePath);
      }
    }

    return baseModule.require(modulePath);
  }
}

// check path aliases
function checkPath(id)
{
  var p;

  for (p in paths)
  {
    if (id.indexOf(p) == 0)
    {
      return id.replace(p, paths[p]);
    }
  }

  return id;
}
