/**
 * Creates global define function to mimic requirejs define in node
 */

var originalRequireJS
  , originalModuleCompile
    // default values
  , exposeAmdefine = false // flag for exposing `.amd` and `.require` properties of `amdefine`
  , paths          = {} // paths aliases
  , blackList      = [] // excludes patterns from global define
  , whiteList      = [] // limits global define to patterns
  , disableCache   = false // disable require'd cache
  , aliasRequire   = false // alias standalone require statements
    // modules
  , fs             = require('fs')
  , path           = require('path')
  , Module         = require('module')
  , amdefine       = require('amdefine')
  , minimatch      = require('minimatch')
  ;

// public api
module.exports = GlobalDefine;

// expose internal method for easier integration
GlobalDefine.prototype.getCallerModule    = getCallerModule;
GlobalDefine.prototype.propagateUpstream  = propagateUpstream;
GlobalDefine.prototype.amdefineWorkaround = amdefineWorkaround;
GlobalDefine.prototype.pretendRequire     = pretendRequire;
GlobalDefine.prototype.requireWrapper     = requireWrapper;
GlobalDefine.prototype.checkPath          = checkPath;
GlobalDefine.prototype.isBlacklisted      = isBlacklisted;
GlobalDefine.prototype.isWhitelisted      = isWhitelisted;
// "private"/"static" api
GlobalDefine._customRequireHandler        = customRequireHandler;

// augment default js extension, only once
if (require.extensions['.js']._id != module.id)
{
  // hijack .js handler to add module specific define function to global namespace
  originalRequireJS = require.extensions['.js'];
  require.extensions['.js'] = customRequireHandler;
  // mark the thing
  require.extensions['.js']._id = module.id;
}

// export API function to update basePath
function GlobalDefine(options)
{
  var globalDefine;

  if (!(this instanceof GlobalDefine))
  {
    globalDefine = new GlobalDefine(options);
    return globalDefine.amdefineWorkaround(globalDefine.getCallerModule());
  }

  this.basePath     = options.basePath || process.cwd();
  this.paths        = options.paths || paths;
  this.pathsKeys    = Object.keys(this.paths).sort(sortPaths);
  this.blackList    = options.blackList || blackList;
  this.whiteList    = options.whiteList || whiteList;
  this.disableCache = options.disableCache || disableCache;
  this.aliasRequire = options.aliasRequire || aliasRequire;
  // if flag provided override default value
  this.exposeAmdefine = ('exposeAmdefine' in options) ? options.exposeAmdefine : exposeAmdefine;

  // construct basePath regexp
  this.basePathRegexp = new RegExp(('^' + this.basePath + '/').replace('/', '\\/'));

  // propagate upstream to allow global-define on sibling branches
  this.propagateUpstream(this.getCallerModule(), options.forceUpstream);

  // being a little bit brutal
  // for things that go around normal module loading process
  // like `istanbul`, that reads (`fs.readFileSync(filename, 'utf8')`)
  // and runs `module._compile(code, filename);` compilation step
  // skipping loading extensions.
  // But do it only once, no need to step on itself
  if (options.invasiveMode && Module.prototype._compile._id != module.id)
  {
    originalModuleCompile = Module.prototype._compile;
    Module.prototype._compile = customModuleCompile;
    Module.prototype._compile._id = module.id;
  }
}

// gets caller (parent or top most) module
function getCallerModule()
{
  return module.parent || process.mainModule;
}

// propagates global-define instance upstream
// until it bumps into another globalDefine instance
function propagateUpstream(parentModule, shouldPropagate)
{
  // do not step on another global-define instance
  if (parentModule._globalDefine) return;

  // keep reference to the define instance
  parentModule._globalDefine = this;

  if (shouldPropagate && parentModule.parent)
  {
    this.propagateUpstream(parentModule.parent, shouldPropagate);
  }
}

// create workaround for amdefine
// to treat all the modules equally
// (by default it doesn't execute modules with ids)
function amdefineWorkaround(requiredModule)
{
  // prepare define function
  var define = amdefine(requiredModule, this.pretendRequire(requiredModule));

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
  if (this.exposeAmdefine)
  {
    wrapper.amd     = define.amd;
    wrapper.require = define.require;
  }

  return wrapper;
}

// check for requested path, if it has "/"" in the path
// and doesn't start with "." or "/"
// treat it as path relative to the project's root
// and replace it with absolute path
function pretendRequire(baseModule)
{
  return this.requireWrapper.bind(this, baseModule);
}

// Wrapping "original" require to allow inclusion
// of the local files in the fashion of mode modules.
// A-la requirejs/amd style
// Note: used within pretendRequire function
function requireWrapper(baseModule, moduleId)
{
  var componentPath
      // translate module to path alias
    , modulePath = this.checkPath(moduleId)
      // get first part of the module path
    , component = (modulePath || '').split('/')[0]
    ;

  // shortcut for `empty:` path
  if (modulePath == 'empty:')
  {
    return {};
  }

  // check if name and path belong to the app or to node_modules
  if (component && component[0] != '.')
  {
    // - existing file vs. node_modules case
    if (component == modulePath)
    {
      componentPath = path.resolve(this.basePath, modulePath + '.js');
    }
    // - existing folder vs. node_modules member case
    else
    {
      componentPath = path.resolve(this.basePath, component);
    }

    if (fs.existsSync(componentPath))
    {
      // everything fits nicely, get the full thing
      // file might not exist at this point
      // but its legit developer's error
      modulePath = path.resolve(this.basePath, modulePath);
    }
  }

  if (this.disableCache)
  {
    delete require.cache[require.resolve(modulePath)];
  }

  return baseModule.require(modulePath);
}

// check path aliases
function checkPath(id)
{
  var i;

  for (i = 0; i < this.pathsKeys.length; i++)
  {
    if (id.indexOf(this.pathsKeys[i]) == 0)
    {
      if (this.paths[this.pathsKeys[i]] == 'empty:')
      {
        id = 'empty:';
      }
      else
      {
        id = id.replace(this.pathsKeys[i], this.paths[this.pathsKeys[i]]);
      }
      break;
    }
  }

  return id;
}

// checks blackList, using glob-like patterns
function isBlacklisted(moduleId)
{
  var i;

  // strip basePath
  moduleId = moduleId.replace(this.basePathRegexp, '');

  for (i = 0; i < this.blackList.length; i++)
  {
    if (minimatch(moduleId, this.blackList[i]))
    {
      return true;
    }
  }

  return false;
}

// checks whiteList, using glob-like patterns
// if white list is empty treat it as everything in white list
function isWhitelisted(moduleId)
{
  var i;

  // check if its empty
  if (!this.whiteList.length)
  {
    return true;
  }

  // strip basePath
  moduleId = moduleId.replace(this.basePathRegexp, '');

  for (i = 0; i < this.whiteList.length; i++)
  {
    if (minimatch(moduleId, this.whiteList[i]))
    {
      return true;
    }
  }

  return false;
}

// --- "Private"/"Static" methods

// replaces original `module._compile` for invasive mode
// but if this._globalDefine is present means our work here is done
// and reset global define back to the previous value
function customModuleCompile(content, filename)
{
  var moduleExceptions, parentDefine = global.define;

  if (!this._globalDefine)
  {
    setGlobalDefine(this);
  }

  moduleExceptions = originalModuleCompile.call(this, content, filename);

  global.define = parentDefine;

  return moduleExceptions;
}

function customRequireHandler(requiredModule, filename)
{
  // store current value of the global.define
  var moduleContent, parentDefine = global.define;

  // set global define for the required module
  setGlobalDefine(requiredModule);

  // compile module as per normal workflow
  moduleContent = originalRequireJS(requiredModule, filename);

  // reset global define back to the previous value
  global.define = parentDefine;

  return moduleContent;
}

// sets _globalDefine and global.define if needed
function setGlobalDefine(requiredModule)
{
  // pass globalDefine instance from parent to child module
  if (requiredModule.parent && requiredModule.parent._globalDefine)
  {
    // inherited instance
    requiredModule._globalDefine = requiredModule.parent._globalDefine;
  }

  // create global define specific to the module
  // but only if its whitelisted and not blacklisted
  if (requiredModule._globalDefine && requiredModule._globalDefine.isWhitelisted(requiredModule.id) && !requiredModule._globalDefine.isBlacklisted(requiredModule.id))
  {
    global.define = requiredModule._globalDefine.amdefineWorkaround(requiredModule);

    // run required paths through alias substituion
    if (requiredModule._globalDefine.aliasRequire)
    {
      requiredModule._originalRequire = requiredModule.require;
      requiredModule.require = function(modulePath)
      {
        return requiredModule._originalRequire.call(this, requiredModule._globalDefine.checkPath(modulePath));
      }
    }
  }
  else
  {
    // reset global define
    delete global.define;
  }
}

// Sorts paths to have more specific paths earlier in the game
function sortPaths(a, b)
{
  return b.length - a.length;
}
