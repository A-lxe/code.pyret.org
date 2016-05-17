require(["pyret-base/js/runtime", "program", "cpo/cpo-builtin-modules"], function(runtimeLib, program, cpoBuiltinModules) {

  var staticModules = program.staticModules;
  var depMap = program.depMap;
  var toLoad = program.toLoad;

  var main = toLoad[toLoad.length - 1];

  var realm = {};

  cpoBuiltinModules.setStaticModules(program.staticModules);

  var runtime = runtimeLib.makeRuntime({
    stdout: function(s) { console.log(s); },
    stderr: function(s) { console.error(s); } 
  });

  runtime.setParam("command-line-arguments", []);
  runtime.setParam("staticModules", program.staticModules);

  var postLoadHooks = {
    "builtin://srcloc": function(srcloc) {
      runtime.srcloc = runtime.getField(runtime.getField(srcloc, "provide-plus-types"), "values");
    },
    "builtin://ffi": function(ffi) {
      cpoBuiltinModules.setRealm(realm);
      ffi = ffi.jsmod;
      runtime.ffi = ffi;
      runtime["throwMessageException"] = ffi.throwMessageException;
      runtime["throwNoBranchesMatched"] = ffi.throwNoBranchesMatched;
      runtime["throwNoCasesMatched"] = ffi.throwNoCasesMatched;
      runtime["throwNonBooleanCondition"] = ffi.throwNonBooleanCondition;
      runtime["throwNonBooleanOp"] = ffi.throwNonBooleanOp;

      var checkList = runtime.makeCheckType(ffi.isList, "List");
      runtime["checkList"] = checkList;

      runtime["checkEQ"] = runtime.makeCheckType(ffi.isEqualityResult, "EqualityResult");
    },
    "builtin://checker": function(checker) {
      checker = runtime.getField(runtime.getField(checker, "provide-plus-types"), "values");
      // NOTE(joe): This is the place to add checkAll
      var currentChecker = runtime.getField(checker, "make-check-context").app(runtime.makeString(main), false);
      runtime.setParam("current-checker", currentChecker);
    }
  };
  postLoadHooks[main] = function(answer) {
    var checkerLib = runtime.modules["builtin://checker"];
    var checker = runtime.getField(runtime.getField(checkerLib, "provide-plus-types"), "values");
    var getStack = function(err) {
      console.error("The error is: ", err);
      var locArray = err.val.pyretStack.map(runtime.makeSrcloc);
      var locList = runtime.ffi.makeList(locArray);
      return locList;
    };
    var getStackP = runtime.makeFunction(getStack);
    var toCall = runtime.getField(checker, "render-check-results-stack");
    var checks = runtime.getField(answer, "checks");
    runtime.safeCall(function() {
      return toCall.app(checks, getStackP);
    }, function(printedCheckResult) {
      if(runtime.isString(printedCheckResult)) {
        console.log(printedCheckResult);
        console.log("\n");
      }
    });
  };

  function renderErrorMessage(execRt, res) {
    var rendererrorMod = execRt.modules["builtin://render-error-display"];
    var rendererror = execRt.getField(rendererrorMod, "provide-plus-types");
    var gf = execRt.getField;
    return execRt.runThunk(function() {
      if(execRt.isPyretVal(res.exn.exn) 
         && execRt.isObject(res.exn.exn) 
         && execRt.hasField(res.exn.exn, "render-reason")) {
        return execRt.safeCall(
          function() { 
            return execRt.getColonField(res.exn.exn, "render-reason").full_meth(res.exn.exn);
          }, function(reason) {
            return execRt.safeCall(
              function() { 
                return gf(gf(rendererror, "values"), "display-to-string").app(
                  reason, 
                  execRt.namespace.get("torepr"), 
                  execRt.ffi.makeList(res.exn.pyretStack.map(execRt.makeSrcloc)));
              }, function(str) {
                return execRt.string_append(
                  str,
                  execRt.makeString("\nStack trace:\n" +
                                    execRt.printPyretStack(res.exn.pyretStack)));
              }, "errordisplay->to-string");
          }, "error->display");
      } else {
        return String(res.exn + "\n" + res.exn.stack);
      }
    }, function(v) {
      if(execRt.isSuccessResult(v)) {
        console.log(v.result);
      } else {
        console.error("There was an exception while rendering the exception: ", v.exn);
      }
    });
  }

  function onComplete(result) {
    if(runtime.isSuccessResult(result)) {
      //console.log("The program completed successfully");
      //console.log(result);
    }
    else {
      console.error("The run ended in error: ", result);
      renderErrorMessage(runtime, result);
      console.error(result.exn.stack);
    }
//    $("#loader").hide();
    console.log(window.performance.now());
  }

  return runtime.runThunk(function() {
    runtime.modules = realm;
    return runtime.runStandalone(staticModules, realm, depMap, toLoad, postLoadHooks);
  }, onComplete);

/*
  loadModulesNew(thisRuntime.namespace, [require("trove/image-lib")], function(i) {
    thisRuntime["imageLib"] = getField(i, "internal");
  });
*/
});
