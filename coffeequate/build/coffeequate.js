(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define(factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.libGlobalName = factory();
    }
}(this, function () {
    //almond, and modules will be inlined here
/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("lib/almond", function(){});

// Generated by CoffeeScript 1.6.3
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define('parse',["require"], function(require) {
    var ParseError, StringToExpression, stringToTerminal;
    ParseError = (function(_super) {
      __extends(ParseError, _super);

      function ParseError(input, type) {
        this.input = input;
        this.type = type;
      }

      ParseError.prototype.toString = function() {
        return "Could not parse '" + this.input + "' as " + this.type;
      };

      return ParseError;

    })(Error);
    stringToTerminal = function(string) {
      var terminals;
      terminals = require("terminals");
      if (/\d+(\.\d+)?/.test(string) || /\d+(\.\d+)?\/\d+(\.\d+)?/.test(string)) {
        return new terminals.Constant(string);
      } else if (/[a-zA-Z][a-zA-Z_\-\d]*/.test(string)) {
        return new terminals.Variable(string);
      } else {
        throw new ParseError(string, "terminal");
      }
    };
    StringToExpression = (function() {
      /*
      			ADDN := MULT | ADDN "+" MULT
      			MULT := POWR | MULT "*" POWR
      			POWR := BRAC | POWR "**" BRAC
      			BRAC := "-" BRAC | "(" ADDN ")" | TERM
      			TERM := <Existing Code>
      */

      function StringToExpression(string) {
        this.tokens = StringToExpression.tokenise(string).reverse();
        this.upto = 0;
        this.operators = require("operators");
        return this.parseAddition();
      }

      StringToExpression.tokenise = function(string) {
        return string.split(/(\*\*|[+*()\-]|\s)/).filter(function(z) {
          return !/^\s*$/.test(z);
        });
      };

      StringToExpression.prototype.getToken = function() {
        return this.tokens[this.upto];
      };

      StringToExpression.prototype.parseAddition = function() {
        var addn, mult;
        mult = this.parseMultiplication();
        if (this.getToken() !== "+") {
          return mult;
        }
        this.upto += 1;
        addn = this.parseAddition();
        return new this.operators.Add(addn, mult);
      };

      StringToExpression.prototype.parseMultiplication = function() {
        var mult, powr;
        powr = this.parsePower();
        if (this.getToken() !== "*") {
          return powr;
        }
        this.upto += 1;
        mult = this.parseMultiplication();
        return new this.operators.Mul(mult, powr);
      };

      StringToExpression.prototype.parsePower = function() {
        var brac, powr;
        brac = this.parseBracket();
        if (this.getToken() !== "**") {
          return brac;
        }
        this.upto += 1;
        powr = this.parsePower();
        return new this.operators.Pow(powr, brac);
      };

      StringToExpression.prototype.parseBracket = function() {
        var addn, term;
        if (this.getToken() === ")") {
          this.upto += 1;
          addn = this.parseAddition();
          if (this.getToken() !== "(") {
            throw new Error(("ParseError: Expected '(' but found '" + (this.getToken()) + "' at position ") + ("" + (this.tokens.length - this.upto) + "/" + this.tokens.length + " in token stream '" + (this.tokens.reverse().join(" ")) + "'"));
          }
          this.upto += 1;
          if (this.getToken() === "-") {
            this.upto += 1;
            return new this.operators.Mul(-1, addn);
          } else {
            return addn;
          }
        } else {
          term = this.parseTerm();
          if (this.getToken() === "-") {
            this.upto += 1;
            return new this.operators.Mul(-1, term);
          } else {
            return term;
          }
        }
      };

      StringToExpression.prototype.parseTerm = function() {
        var term;
        term = stringToTerminal(this.getToken());
        this.upto += 1;
        return term;
      };

      return StringToExpression;

    })();
    return {
      ParseError: ParseError,
      stringToExpression: function(string) {
        return new StringToExpression(string);
      },
      constant: function(value) {
        if (typeof value === "string" || value instanceof String) {
          if (value === "") {
            throw new ParseError("", "constant");
          }
          value = value.split("/");
          if (value.length === 1) {
            return [parseFloat(value[0]), 1];
          } else if (value.length === 2) {
            return [parseFloat(value[0]), parseFloat(value[1])];
          } else {
            throw new ParseError(value.join("/"), "constant");
          }
        } else if (typeof value === "number" || value instanceof Number) {
          return [value, 1];
        } else {
          throw new ParseError(value, "constant");
        }
      },
      stringToTerminal: stringToTerminal
    };
  });

}).call(this);

// Generated by CoffeeScript 1.6.3
(function() {
  define('generateInfo',[],function() {
    return {
      getMathMLInfo: function(equationID, expression, equality) {
        var html, mathClass, mathID;
        if (equality == null) {
          equality = "0";
        }
        mathClass = expression ? "expression" : "equation";
        mathID = "" + mathClass + "-" + (equationID != null ? equationID : Math.floor(Math.random() * 10000000).toString(16));
        html = '<div id="' + mathID + '" class="' + mathClass + '"><math xmlns="http://www.w3.org/1998/Math/MathML">' + (equality != null ? (isFinite(equality) ? "<mn>" + equality + "</mn>" : (equality.toMathML != null ? "" + (equality.toMathML(equationID, expression)) : "<mi>" + equality + "</mi>")) + "<mo>=</mo>" : "");
        return [mathClass, mathID, html];
      },
      getHTMLInfo: function(equationID, expression, equality) {
        var html, mathClass, mathID;
        if (equality == null) {
          equality = "0";
        }
        mathClass = expression ? "expression" : "equation";
        mathID = "" + mathClass + "-" + (equationID != null ? equationID : Math.floor(Math.random() * 10000000).toString(16));
        html = '<div id="' + mathID + '" class="' + mathClass + '">' + (equality != null ? (equality.toHTML != null ? "" + (equality.toHTML(equationID, expression)) : "" + equality) + "=" : "");
        return [mathClass, mathID, html];
      }
    };
  });

}).call(this);

// Generated by CoffeeScript 1.6.3
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define('terminals',["parse", "generateInfo"], function(parse, generateInfo) {
    var Constant, SymbolicConstant, Terminal, Variable;
    Terminal = (function() {
      function Terminal(label) {
        this.label = label;
      }

      Terminal.prototype.evaluate = function() {};

      Terminal.prototype.copy = function() {
        return new Terminal(this.label);
      };

      Terminal.prototype.toString = function() {
        return this.label;
      };

      return Terminal;

    })();
    Constant = (function(_super) {
      __extends(Constant, _super);

      function Constant(value, denominator) {
        var _ref, _ref1;
        this.denominator = denominator != null ? denominator : null;
        this.cmp = -6;
        if (this.denominator != null) {
          _ref = parse.constant(value), this.numerator = _ref[0], denominator = _ref[1];
          this.denominator *= denominator;
        } else {
          _ref1 = parse.constant(value), this.numerator = _ref1[0], this.denominator = _ref1[1];
        }
      }

      Constant.prototype.evaluate = function() {
        return this.numerator / this.denominator;
      };

      Constant.prototype.copy = function() {
        return new Constant(this.numerator, this.denominator);
      };

      Constant.prototype.compareSameType = function(b) {
        if (this.evaluate() < b.evaluate()) {
          return -1;
        } else if (this.evaluate() === b.evaluate()) {
          return 0;
        } else {
          return 1;
        }
      };

      Constant.prototype.multiply = function(b) {
        return new Constant(this.numerator * b.numerator, this.denominator * b.denominator);
      };

      Constant.prototype.add = function(b) {
        return new Constant(b.denominator * this.numerator + this.denominator * b.numerator, this.denominator * b.denominator);
      };

      Constant.prototype.equals = function(b) {
        if (!(b instanceof Constant)) {
          return false;
        }
        return this.evaluate() === b.evaluate();
      };

      Constant.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        if (topLevel) {
          _ref = generateInfo.getMathMLInfo(equationID, expression), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
          closingHTML = "</math></div>";
        } else {
          html = "";
          closingHTML = "";
        }
        if (this.denominator === 1) {
          return "<mn>" + this.numerator + "</mn>";
        }
        return "<mfrac><mrow><mn>" + this.numerator + "</mn></mrow><mrow><mn>" + this.denominator + "</mn></mrow</mfrac>";
      };

      Constant.prototype.toHTML = function() {
        if (this.denominator === 1) {
          return "" + this.numerator;
        }
        return "(" + this.numerator + "/" + this.denominator + ")";
      };

      Constant.prototype.toLaTeX = function() {
        if (this.denominator === 1) {
          return "" + this.numerator;
        }
        return "\\frac{" + this.numerator + "}{" + this.denominator + "}";
      };

      Constant.prototype.toString = function() {
        if (this.denominator !== 1) {
          return "" + this.numerator + "/" + this.denominator;
        }
        return "" + this.numerator;
      };

      return Constant;

    })(Terminal);
    SymbolicConstant = (function(_super) {
      __extends(SymbolicConstant, _super);

      function SymbolicConstant(label, value) {
        this.label = label;
        this.value = value != null ? value : null;
        this.cmp = -5;
      }

      SymbolicConstant.prototype.copy = function() {
        return new SymbolicConstant(this.label, this.value);
      };

      SymbolicConstant.prototype.compareSameType = function(b) {
        if (this.label < b.label) {
          return -1;
        } else if (this.label === b.label) {
          return 0;
        } else {
          return 1;
        }
      };

      SymbolicConstant.prototype.evaluate = function() {
        return this.value;
      };

      SymbolicConstant.prototype.equals = function(b) {
        if (!(b instanceof SymbolicConstant)) {
          return false;
        }
        return this.label === b.label && this.value === b.value;
      };

      SymbolicConstant.prototype.toHTML = function() {
        return this.toString();
      };

      SymbolicConstant.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        if (topLevel) {
          _ref = generateInfo.getMathMLInfo(equationID, expression), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
          closingHTML = "</math></div>";
        } else {
          html = "";
          closingHTML = "";
        }
        return "" + html + "<mn>" + this.label + "</mn>" + closingHTML;
      };

      SymbolicConstant.prototype.toLaTeX = function() {
        return this.toString();
      };

      return SymbolicConstant;

    })(Terminal);
    Variable = (function(_super) {
      __extends(Variable, _super);

      function Variable(label) {
        this.label = label;
        this.cmp = -4;
      }

      Variable.prototype.copy = function() {
        return new Variable(this.label);
      };

      Variable.prototype.compareSameType = function(b) {
        if (this.label < b.label) {
          return -1;
        } else if (this.label === b.label) {
          return 0;
        } else {
          return 1;
        }
      };

      Variable.prototype.equals = function(b) {
        if (!(b instanceof Variable)) {
          return false;
        }
        return b.label === this.label;
      };

      Variable.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, label, labelArray, labelID, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        if (topLevel) {
          _ref = generateInfo.getMathMLInfo(equationID, expression), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
          closingHTML = "</math></div>";
        } else {
          html = "";
          closingHTML = "";
        }
        labelArray = this.label.split("-");
        label = labelArray[0];
        labelID = labelArray[1] != null ? 'id="variable-' + (expression ? "expression" : "equation") + ("-" + equationID + "-") + this.label + '"' : "";
        if (label.length > 1) {
          return html + '<msub class="variable"' + labelID + '><mi>' + label[0] + '</mi><mi>' + label.slice(1) + "</mi></msub>" + closingHTML;
        } else {
          return html + '<mi class="variable"' + labelID + '>' + label + '</mi>' + closingHTML;
        }
      };

      Variable.prototype.toHTML = function() {
        var label, labelArray, labelID;
        labelArray = this.label.split("-");
        label = labelArray[0];
        labelID = labelArray[1] != null ? 'id="variable-' + this.label + '"' : "";
        return '<span class="variable"' + labelID + '>' + label + '</span>';
      };

      Variable.prototype.toLaTeX = function() {
        return this.toString();
      };

      return Variable;

    })(Terminal);
    return {
      Terminal: Terminal,
      Variable: Variable,
      Constant: Constant,
      SymbolicConstant: SymbolicConstant
    };
  });

}).call(this);

// Generated by CoffeeScript 1.6.3
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define('nodes',[],function() {
    var BasicNode;
    BasicNode = (function() {
      function BasicNode(label) {
        this.label = label;
      }

      BasicNode.prototype.getChildren = function() {
        return [];
      };

      return BasicNode;

    })();
    return {
      BasicNode: BasicNode,
      RoseNode: (function(_super) {
        __extends(_Class, _super);

        function _Class(label, children) {
          this.children = children != null ? children : null;
          if (this.children == null) {
            this.children = [];
          }
          _Class.__super__.constructor.call(this, label);
        }

        _Class.prototype.getChildren = function() {
          return this.children;
        };

        _Class.prototype.toLisp = function() {
          return "(" + this.label + (this.children ? " " : "") + (this.children.join(" ")) + ")";
        };

        _Class.prototype.toString = function() {
          return "(" + (this.children.join(" " + this.label + " ")) + ")";
        };

        return _Class;

      })(BasicNode),
      BinaryNode: (function(_super) {
        __extends(_Class, _super);

        function _Class(label, left, right) {
          this.label = label;
          this.children = {
            left: left,
            right: right
          };
        }

        _Class.prototype.getChildren = function() {
          return [this.children.left, this.children.right];
        };

        _Class.prototype.toLisp = function() {
          return "(" + this.label + " " + this.children.left + " " + this.children.right + ")";
        };

        _Class.prototype.toString = function() {
          return "(" + this.children.left + " " + this.label + " " + this.children.right + ")";
        };

        return _Class;

      })(BasicNode)
    };
  });

}).call(this);

// Generated by CoffeeScript 1.6.3
(function() {
  var __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  define('Equation',["terminals", "nodes", "parse"], function(terminals, nodes, parse) {
    var Equation;
    Equation = (function() {
      function Equation() {
        var args, sides;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        switch (args.length) {
          case 1:
            if (args[0] instanceof String || typeof args[0] === "string") {
              sides = args[0].split("=");
              switch (sides.length) {
                case 1:
                  this.left = new terminals.Constant("0");
                  this.right = parse.stringToExpression(sides[0]);
                  break;
                case 2:
                  this.left = parse.stringToTerminal(sides[0]);
                  this.right = parse.stringToExpression(sides[1]);
                  break;
                default:
                  throw new Error("Too many '=' signs.");
              }
            } else if (args[0] instanceof terminals.Terminal || args[0] instanceof nodes.BasicNode) {
              this.left = new terminals.Constant("0");
              this.right = args[0].copy();
            } else {
              throw new Error("Argument must be a String, Terminal, or Node.");
            }
            break;
          case 2:
            if (args[0] instanceof String || typeof args[0] === "string") {
              this.left = parse.stringToTerminal(args[0]);
            } else if (args[0] instanceof terminals.Terminal || args[0] instanceof nodes.BasicNode) {
              this.left = args[0].copy();
            } else {
              throw new Error("Argument must be a String, Terminal, or Node.");
            }
            if (args[1] instanceof String || typeof args[1] === "string") {
              this.right = parse.stringToExpression(args[1]);
            } else if (args[1] instanceof terminals.Terminal || args[1] instanceof nodes.BasicNode) {
              this.right = args[1].copy();
            } else {
              throw new Error("Argument must be a String, Terminal, or Node.");
            }
            break;
          default:
            throw new Error("Too many arguments.");
        }
      }

      Equation.prototype.solve = function(variable) {
        var expr;
        expr = new Add(this.right, new Mul("-1", this.left));
        return new Equation(variable, expr.solve(variable));
      };

      Equation.prototype.replaceVariables = function(replacements) {
        this.left.replaceVariables(replacements);
        return this.right.replaceVariables(replacements);
      };

      Equation.prototype.getAllVariables = function() {
        var leftVars, rightVars, variable, _i, _len, _results;
        leftVars = this.left.getAllVariables();
        rightVars = this.right.getAllVariables();
        _results = [];
        for (_i = 0, _len = leftVars.length; _i < _len; _i++) {
          variable = leftVars[_i];
          if (__indexOf.call(rightVars, variable) < 0) {
            _results.push(rightVars.unshift(variable));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };

      Equation.prototype.sub = function(substitutions) {
        var expr;
        if (this.left instanceof terminals.Variable && this.left.label in substitutions) {
          expr = new Add(this.right, new Mul("-1", this.left));
          return new Equation(expr.sub(substitutions));
        } else {
          return new Equation(this.left, this.right.sub(substitutions));
        }
      };

      Equation.prototype.substituteExpression = function(source, variable, equivalencies) {
        var expr;
        if (this.left instanceof terminals.Variable && this.left.label in substitutions) {
          expr = new Add(this.right, new Mul("-1", this.left));
          return new Equation(expr.substituteExpression(source, variable, equivalencies));
        } else {
          return new Equation(this.left, this.right.substituteExpression(source, variable, equivalencies));
        }
      };

      Equation.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = null;
        }
        if (topLevel == null) {
          topLevel = false;
        }
        return this.right.toMathML(equationID, expression, this.left, topLevel);
      };

      Equation.prototype.toHTML = function(equationID, expression, equality, topLevel) {
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = null;
        }
        if (topLevel == null) {
          topLevel = false;
        }
        return this.right.toHTML(equationID, expression, this.left, topLevel);
      };

      Equation.prototype.toLaTeX = function() {
        return "" + (this.left.toLaTeX()) + " = " + (this.right.toLaTeX());
      };

      Equation.prototype.toString = function() {
        return "" + left + " = " + right;
      };

      return Equation;

    })();
    return Equation;
  });

}).call(this);

// Generated by CoffeeScript 1.6.3
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  define('operators',["nodes", "parse", "terminals", "generateInfo"], function(nodes, parse, terminals, generateInfo) {
    var Add, AlgebraError, Mul, Pow, compare, parseArgs, prettyPrint;
    AlgebraError = (function(_super) {
      __extends(AlgebraError, _super);

      function AlgebraError(expr, variable, postscript) {
        if (postscript == null) {
          postscript = null;
        }
        AlgebraError.__super__.constructor.call(this, "Unsolvable: " + expr + " for " + variable + (postscript ? ";" + postscript : ""));
      }

      return AlgebraError;

    })(Error);
    prettyPrint = function(array) {
      var i, out, _i, _len;
      out = [];
      for (_i = 0, _len = array.length; _i < _len; _i++) {
        i = array[_i];
        if (i instanceof Array) {
          out.push(prettyPrint(i));
        } else {
          out.push(typeof i.toString === "function" ? i.toString() : void 0);
        }
      }
      return "[" + out.join(", ") + "]";
    };
    parseArgs = function() {
      var arg, args, outArgs, _i, _len;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      outArgs = [];
      for (_i = 0, _len = args.length; _i < _len; _i++) {
        arg = args[_i];
        if (typeof arg === "string" || arg instanceof String) {
          outArgs.push(parse.stringToTerminal(arg));
        } else if (typeof arg === "number" || arg instanceof Number) {
          outArgs.push(new terminals.Constant(arg));
        } else if (arg instanceof terminals.Terminal || arg instanceof nodes.BasicNode || (arg.isTerminal != null)) {
          outArgs.push(arg);
        } else {
          throw new Error("Invalid argument " + arg + ", (" + (typeof arg) + "), (" + (arg.toString()) + ")");
        }
      }
      return outArgs;
    };
    Add = (function(_super) {
      __extends(Add, _super);

      function Add() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        if (args.length < 1) {
          throw new Error("Add nodes must have at least one child.");
        }
        this.cmp = -1;
        args = parseArgs.apply(null, args);
        Add.__super__.constructor.call(this, "+", args);
      }

      Add.prototype.copy = function() {
        var args, i;
        args = (function() {
          var _i, _len, _ref, _results;
          _ref = this.children;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            i = _ref[_i];
            _results.push(i.copy != null ? i.copy() : i);
          }
          return _results;
        }).call(this);
        return (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(Add, args, function(){});
      };

      Add.prototype.compareSameType = function(b) {
        var c, child, index, lengthComparison, _i, _len, _ref;
        if (this.children.length === b.children.length) {
          lengthComparison = 0;
        } else if (this.children.length < b.children.length) {
          lengthComparison = -1;
        } else {
          lengthComparison = 1;
        }
        _ref = this.children;
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          child = _ref[index];
          if (b.children[index] == null) {
            return 1;
          }
          c = compare(this.children[index], b.children[index]);
          if (c !== 0) {
            return c;
          }
        }
        return lengthComparison;
      };

      Add.prototype.expand = function() {
        var add, c, child, children, _i, _j, _len, _len1, _ref, _ref1;
        children = [];
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child.expand != null) {
            child = child.expand();
          } else if (child.copy != null) {
            child = child.copy();
          }
          if (child instanceof Add) {
            _ref1 = child.children;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              c = _ref1[_j];
              children.push(c);
            }
          } else {
            children.push(child);
          }
        }
        add = (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(Add, children, function(){});
        add.sort();
        return add;
      };

      Add.prototype.sort = function() {
        var child, _i, _len, _ref;
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (typeof child.sort === "function") {
            child.sort();
          }
        }
        return this.children.sort(compare);
      };

      Add.prototype.equals = function(b) {
        var child, index, _i, _len, _ref;
        if (!(b instanceof Add)) {
          return false;
        }
        if (b.children.length !== this.children.length) {
          return false;
        }
        _ref = this.children;
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          child = _ref[index];
          if (child.equals != null) {
            if (!child.equals(b.children[index])) {
              return false;
            }
          } else {
            if (child !== b.children[index]) {
              return false;
            }
          }
        }
        return true;
      };

      Add.prototype.simplify = function() {
        var c, child, constantterm, constanttermmul, found, i, index, liketerm, liketerms, newAdd, newMul, term, terms, variabletermmul, _base, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2;
        terms = [];
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child.simplify != null) {
            child = child.simplify();
          } else if (child.copy != null) {
            child = child.copy();
          }
          terms.push(child);
        }
        liketerms = [];
        constantterm = null;
        i = 0;
        while (i < terms.length) {
          term = terms[i];
          if (term instanceof Add) {
            terms.splice(i, 1)[0];
            _ref1 = term.children;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              c = _ref1[_j];
              terms.push(c);
            }
            i -= 1;
          } else if (term instanceof terminals.Constant) {
            if (constantterm != null) {
              constantterm = constantterm.add(term);
            } else {
              constantterm = term.copy();
            }
          } else if (term instanceof Mul) {
            constanttermmul = null;
            variabletermmul = null;
            _ref2 = term.children;
            for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
              child = _ref2[_k];
              if (child instanceof terminals.Constant) {
                if (constanttermmul != null) {
                  constanttermmul = constanttermmul.multiply(child);
                } else {
                  constanttermmul = child.copy();
                }
              } else {
                if (variabletermmul != null) {
                  variabletermmul.children.push(child);
                } else {
                  variabletermmul = new Mul(child);
                }
              }
            }
            if (variabletermmul.children.length === 1) {
              variabletermmul = variabletermmul.children[0];
            }
            if ((constanttermmul != null) && (variabletermmul == null)) {
              if (constantterm != null) {
                constantterm = constantterm.add(constanttermmul);
              } else {
                constantterm = constanttermmul.copy();
              }
            } else {
              if (constanttermmul == null) {
                constanttermmul = new terminals.Constant("1");
              }
              found = false;
              for (index = _l = 0, _len3 = liketerms.length; _l < _len3; index = ++_l) {
                liketerm = liketerms[index];
                if (liketerm[0].equals != null) {
                  if (liketerm[0].equals(variabletermmul)) {
                    liketerms[index][1] = new Add(liketerm[1], constanttermmul);
                    liketerms[index][1] = liketerms[index][1].simplify();
                    found = true;
                  }
                } else if (liketerm[0] === variabletermmul) {
                  liketerms[index][1] = new Add(liketerm[1], constanttermmul);
                  liketerms[index][1] = liketerms[index][1].simplify();
                  found = true;
                }
              }
              if (!found) {
                liketerms.push([variabletermmul, constanttermmul]);
              }
            }
          } else {
            found = false;
            for (index = _m = 0, _len4 = liketerms.length; _m < _len4; index = ++_m) {
              liketerm = liketerms[index];
              if (liketerm[0].equals != null) {
                if (liketerm[0].equals(term)) {
                  liketerms[index][1] = new Add(liketerm[1], new terminals.Constant("1"));
                  liketerms[index][1] = liketerms[index][1].simplify();
                  found = true;
                }
              } else if (liketerm[0] === term) {
                liketerms[index][1] = new Add(liketerm[1], new terminals.Constant("1"));
                liketerms[index][1] = liketerms[index][1].simplify();
                found = true;
              }
            }
            if (!found) {
              liketerms.push([term, new terminals.Constant("1")]);
            }
          }
          i += 1;
        }
        newAdd = null;
        for (_n = 0, _len5 = liketerms.length; _n < _len5; _n++) {
          liketerm = liketerms[_n];
          if ((liketerm[0].children != null) && liketerm[0].children.length === 1) {
            liketerm[0] = liketerm[0].children[0];
          }
          if ((typeof (_base = liketerm[1]).evaluate === "function" ? _base.evaluate() : void 0) !== 1) {
            newMul = new Mul(liketerm[0], liketerm[1]);
            newMul = newMul.simplify();
          } else {
            newMul = liketerm[0];
          }
          if (newAdd != null) {
            newAdd.children.push(newMul);
          } else {
            newAdd = new Add(newMul);
          }
        }
        if (newAdd == null) {
          return constantterm;
        }
        if ((constantterm != null) && constantterm.evaluate() !== 0) {
          newAdd.children.push(constantterm);
        }
        newAdd.sort();
        if (newAdd.children.length !== 1) {
          return newAdd;
        }
        return newAdd.children[0];
      };

      Add.prototype.expandAndSimplify = function() {
        var expr;
        expr = this.expand();
        if (expr.simplify != null) {
          return expr.simplify();
        }
        return expr;
      };

      Add.prototype.solve = function(variable) {
        var a, added, b, c, d, expr, factorised, factorisedEquatable, factorisedSquares, factorisedSquaresEquatable, factorisedTerm, negatedNewerPow, negatedTerms, negatedTermsEquatable, newMul, newPow, newerPow, nonNegatedTermsEquatable, power, quadratic, rd, subterm, subterms, term, termsContainingVariable, termsNotContainingVariable, v1, v2, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _ref, _ref1, _ref2;
        expr = this.expandAndSimplify();
        termsContainingVariable = [];
        termsNotContainingVariable = [];
        if (expr instanceof terminals.Terminal) {
          if (expr instanceof terminals.Variable && expr.label === variable) {
            return [new terminals.Constant("0")];
          } else {
            throw new AlgebraError(expr.toString(), variable);
          }
        }
        if (!(expr instanceof Add)) {
          return expr.solve(variable);
        }
        _ref = expr.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          term = _ref[_i];
          if (term.copy != null) {
            term = term.copy();
          }
          if (term instanceof Pow) {
            if (term.children.left instanceof terminals.Variable && term.children.left.label === variable) {
              termsContainingVariable.push(term);
            } else {
              termsNotContainingVariable.push(term);
            }
          } else if (term instanceof Mul) {
            added = false;
            _ref1 = term.children;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              subterm = _ref1[_j];
              if (subterm instanceof terminals.Variable && subterm.label === variable) {
                termsContainingVariable.push(term);
                added = true;
                break;
              } else if (subterm instanceof Pow && subterm.children.left instanceof terminals.Variable && subterm.children.left.label === variable) {
                termsContainingVariable.push(term);
                added = true;
                break;
              }
            }
            if (!added) {
              termsNotContainingVariable.push(term);
            }
          } else if (term instanceof terminals.Variable && term.label === variable) {
            termsContainingVariable.push(term);
          } else {
            termsNotContainingVariable.push(term);
          }
        }
        if (termsContainingVariable.length === 0) {
          throw new AlgebraError(expr.toString(), variable);
        }
        factorised = [];
        factorisedSquares = [];
        for (_k = 0, _len2 = termsContainingVariable.length; _k < _len2; _k++) {
          term = termsContainingVariable[_k];
          if (term instanceof terminals.Variable) {
            factorised.push(new terminals.Constant("1"));
          } else if (term instanceof Pow) {
            if (!(term.children.right instanceof terminals.Constant)) {
              throw new AlgebraError(expr.toString(), variable);
            }
            power = term.children.right.evaluate();
            if (power === 1) {
              factorised.push(new terminals.Constant("1"));
            } else if (power === 2) {
              factorisedSquares.push(new terminals.Constant("1"));
            } else {
              throw new AlgebraError(expr.toString(), variable, "polynomials of degree > 2 not supported");
            }
          } else if (term instanceof Mul) {
            subterms = [];
            quadratic = false;
            _ref2 = term.children;
            for (_l = 0, _len3 = _ref2.length; _l < _len3; _l++) {
              subterm = _ref2[_l];
              if (subterm instanceof terminals.Variable && subterm.label === variable) {

              } else if (subterm instanceof Pow) {
                if (!(subterm.children.right instanceof terminals.Constant)) {
                  throw new AlgebraError(expr.toString(), variable);
                }
                power = subterm.children.right.evaluate();
                if (power === 1) {

                } else if (power === 2) {
                  quadratic = true;
                } else {
                  throw new AlgebraError(expr.toString(), variable, "polynomials of degree > 2 not supported");
                }
              } else {
                subterms.push(subterm);
              }
            }
            factorisedTerm = (function(func, args, ctor) {
              ctor.prototype = func.prototype;
              var child = new ctor, result = func.apply(child, args);
              return Object(result) === result ? result : child;
            })(Mul, subterms, function(){});
            if (!quadratic) {
              factorised.push(factorisedTerm);
            } else {
              factorisedSquares.push(factorisedTerm);
            }
          }
        }
        negatedTerms = [];
        for (_m = 0, _len4 = termsNotContainingVariable.length; _m < _len4; _m++) {
          term = termsNotContainingVariable[_m];
          newMul = new Mul("-1", (term.copy != null ? term.copy() : term));
          newMul = newMul.simplify();
          negatedTerms.push(newMul);
        }
        if (negatedTerms.length !== 0) {
          negatedTermsEquatable = (function(func, args, ctor) {
            ctor.prototype = func.prototype;
            var child = new ctor, result = func.apply(child, args);
            return Object(result) === result ? result : child;
          })(Add, negatedTerms, function(){});
        }
        if (factorised.length !== 0) {
          factorisedEquatable = (function(func, args, ctor) {
            ctor.prototype = func.prototype;
            var child = new ctor, result = func.apply(child, args);
            return Object(result) === result ? result : child;
          })(Add, factorised, function(){});
        }
        if (factorisedSquares.length !== 0) {
          factorisedSquaresEquatable = (function(func, args, ctor) {
            ctor.prototype = func.prototype;
            var child = new ctor, result = func.apply(child, args);
            return Object(result) === result ? result : child;
          })(Add, factorisedSquares, function(){});
        }
        if (factorisedSquares.length === 0) {
          if (factorised.length > 0) {
            newPow = new Pow(factorisedEquatable, "-1");
            newPow = newPow.simplify();
            if (negatedTermsEquatable != null) {
              newMul = new Mul(negatedTermsEquatable, newPow);
              newMul = newMul.simplify();
              return [newMul];
            } else {
              return [newPow];
            }
          } else {
            throw new AlgebraError(expr.toString(), variable);
          }
        } else if (factorised.length === 0) {
          if (factorisedSquares.length > 0) {
            newPow = new Pow(factorisedSquaresEquatable, "-1");
            newPow = newPow.simplify();
            if (negatedTermsEquatable != null) {
              newMul = new Mul(negatedTermsEquatable, newPow);
              newerPow = new Pow(newMul, "1/2");
              negatedNewerPow = new Mul("-1", newerPow);
              negatedNewerPow = negatedNewerPow.simplify();
              newerPow = newerPow.simplify();
              return [newerPow, negatedNewerPow];
            } else {
              newerPow = new Pow(newPow, "1/2");
              negatedNewerPow = new Mul("-1", newerPow);
              negatedNewerPow = negatedNewerPow.simplify();
              newerPow = newerPow.simplify();
              return [newerPow, negatedNewerPow];
            }
          } else {
            throw new AlgebraError(expr.toString(), variable);
          }
        } else {
          if (termsNotContainingVariable.length !== 0) {
            nonNegatedTermsEquatable = (function(func, args, ctor) {
              ctor.prototype = func.prototype;
              var child = new ctor, result = func.apply(child, args);
              return Object(result) === result ? result : child;
            })(Add, termsNotContainingVariable, function(){});
          }
          if (nonNegatedTermsEquatable != null) {
            a = factorisedSquaresEquatable;
            b = factorisedEquatable;
            c = nonNegatedTermsEquatable;
            d = new Add(new Pow(b, "2"), new Mul("-4", a, c));
            rd = new Pow(d, "1/2");
            v1 = new Mul(new Add(new Mul("-1", b), rd), new Pow(new Mul("2", a), "-1"));
            v2 = new Mul("-1", new Add(b, rd), new Pow(new Mul("2", a), "-1"));
            v1 = v1.expandAndSimplify();
            v2 = v2.expandAndSimplify();
            if ((v1.equals != null) && v1.equals(v2)) {
              return [v1];
            }
            return [v1, v2];
          } else {
            newPow = new Pow(factorisedSquaresEquatable, "-1");
            newMul = new Mul("-1", factorisedEquatable, newPow);
            newMul = newMul.simplify();
            return [0, newMul];
          }
        }
      };

      Add.prototype.getAllVariables = function() {
        var child, childVariables, outVariables, variable, variables, _i, _j, _len, _len1, _ref;
        variables = {};
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable) {
            variables[child.label] = true;
          } else if (child.getAllVariables != null) {
            childVariables = child.getAllVariables();
            for (_j = 0, _len1 = childVariables.length; _j < _len1; _j++) {
              variable = childVariables[_j];
              variables[variable] = true;
            }
          }
        }
        outVariables = [];
        for (variable in variables) {
          outVariables.push(variable);
        }
        return outVariables;
      };

      Add.prototype.replaceVariables = function(replacements) {
        var child, index, _i, _len, _ref, _results;
        _ref = this.children;
        _results = [];
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          child = _ref[index];
          if (child instanceof terminals.Variable && child.label in replacements) {
            _results.push(this.children[index].label = replacements[child.label]);
          } else if (child.replaceVariables != null) {
            _results.push(child.replaceVariables(replacements));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };

      Add.prototype.sub = function(substitutions) {
        var child, children, newAdd, variable, _i, _len, _ref;
        for (variable in substitutions) {
          if (!(substitutions[variable] instanceof terminals.Terminal || substitutions[variable] instanceof nodes.BasicNode)) {
            substitutions[variable] = new terminals.Constant(substitutions[variable]);
          }
        }
        children = [];
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable && child.label in substitutions) {
            children.push(substitutions[child.label].copy());
          } else if (child.sub != null) {
            children.push(child.sub(substitutions));
          } else {
            children.push(child.copy());
          }
        }
        newAdd = (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(Add, children, function(){});
        newAdd = newAdd.expandAndSimplify();
        return newAdd;
      };

      Add.prototype.substituteExpression = function(sourceExpression, variable, equivalencies) {
        var child, children, _i, _len, _ref, _results;
        if (equivalencies == null) {
          equivalencies = null;
        }
        children = [];
        _ref = this.children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable && child.label === variable) {
            _results.push(children.push(sourceExpression.copy()));
          } else if (child.substituteExpression != null) {
            _results.push(children.push(substituteExpression(sourcex, variable, equivalencies)));
          } else {
            _results.push(children.push(child.copy()));
          }
        }
        return _results;
      };

      Add.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        _ref = generateInfo.getMathMLInfo(equationID, expression, equality), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
        if (!topLevel) {
          html = "";
          closingHTML = "";
        } else {
          closingHTML = "</math></div>";
        }
        return html + "<mrow>" + this.children.map(function(child) {
          return "<mfenced>" + child.toMathML(equationID, expression) + "</mfenced>";
        }).join("<mo>+</mo>") + "</mrow>" + closingHTML;
      };

      Add.prototype.toHTML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        _ref = generateInfo.getHTMLInfo(equationID, expression, equality), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
        if (!topLevel) {
          html = "";
          closingHTML = "";
        } else {
          closingHTML = "</div>";
        }
        return html + this.children.map(function(child) {
          return "(" + child.toHTML() + ")";
        }).join("+") + closingHTML;
      };

      Add.prototype.toLaTeX = function() {
        return this.children.map(function(child) {
          return "\\left(" + child.toLaTeX() + "\\right)";
        }).join("+");
      };

      return Add;

    })(nodes.RoseNode);
    Mul = (function(_super) {
      __extends(Mul, _super);

      function Mul() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        if (args.length < 1) {
          throw new Error("Mul nodes must have at least one child.");
        }
        this.cmp = -2;
        args = parseArgs.apply(null, args);
        Mul.__super__.constructor.call(this, "*", args);
      }

      Mul.prototype.copy = function() {
        var args, i;
        args = (function() {
          var _i, _len, _ref, _results;
          _ref = this.children;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            i = _ref[_i];
            _results.push(i.copy != null ? i.copy() : i);
          }
          return _results;
        }).call(this);
        return (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(Mul, args, function(){});
      };

      Mul.prototype.simplifyConstants = function() {
        var child, constantterm, variableterm, _i, _len, _ref;
        constantterm = new terminals.Constant("1");
        variableterm = null;
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Constant) {
            constantterm = constantterm.multiply(child);
          } else {
            if (variableterm != null) {
              variableterm.children.push(child);
            } else {
              variableterm = new Mul(child);
            }
          }
        }
        if (variableterm == null) {
          return constantterm;
        }
        if (constantterm.evaluate() === 1) {
          return variableterm;
        }
        return new Mul(constantterm, variableterm);
      };

      Mul.prototype.compareSameType = function(b) {
        var c, child, index, lengthComparison, _i, _len, _ref;
        if (this.children.length === b.children.length) {
          lengthComparison = 0;
        } else if (this.children.length < b.children.length) {
          lengthComparison = -1;
        } else {
          lengthComparison = 1;
        }
        _ref = this.children;
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          child = _ref[index];
          if (b.children[index] == null) {
            return 1;
          }
          c = compare(this.children[index], b.children[index]);
          if (c !== 0) {
            return c;
          }
        }
        return lengthComparison;
      };

      Mul.expandMulAdd = function(mul, add) {
        var c, child, newAdd, newMul, results, _i, _j, _len, _len1, _ref, _ref1;
        results = [];
        _ref = add.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child.copy != null) {
            child = child.copy();
          }
          if (child instanceof Mul) {
            newMul = mul.copy();
            _ref1 = child.children;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              c = _ref1[_j];
              newMul.children.push(c);
            }
          } else if (child instanceof Add) {
            newMul = Mul.expandMulAdd(mul, child);
          } else {
            if (mul.children.length === 1) {
              newMul = mul.copy();
              newMul.children.push(child.copy());
            } else {
              newMul = new Mul(mul.copy(), child.copy());
            }
          }
          results.push(newMul);
        }
        newAdd = (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(Add, results, function(){});
        newAdd = newAdd.expand();
        return newAdd;
      };

      Mul.prototype.equals = function(b) {
        var child, index, _i, _len, _ref;
        if (!(b instanceof Mul)) {
          return false;
        }
        if (b.children.length !== this.children.length) {
          return false;
        }
        _ref = this.children;
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          child = _ref[index];
          if (child.equals != null) {
            if (!child.equals(b.children[index])) {
              return false;
            }
          } else {
            if (child !== b.children[index]) {
              return false;
            }
          }
        }
        return true;
      };

      Mul.prototype.expand = function() {
        var child, newMul, results, term, _base, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
        term = [];
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child.expand != null) {
            child = child.expand();
          } else if (child.copy != null) {
            child = child.copy();
          }
          term.push(child);
        }
        while (term.length > 1) {
          if (term[0] instanceof Mul) {
            if (term[1] instanceof Add) {
              term[0] = Mul.expandMulAdd(term[0], term.splice(1, 1)[0]);
            } else if (term[1] instanceof Mul) {
              _ref1 = term.splice(1, 1)[0].children;
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                child = _ref1[_j];
                term[0].children.push(child);
              }
            } else {
              term[0].children.push(term.splice(1, 1)[0]);
            }
          } else if (term[0] instanceof Add) {
            if (term[1] instanceof Add) {
              results = [];
              _ref2 = term[0].children;
              for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
                child = _ref2[_k];
                newMul = new Mul(child, term[1]);
                newMul = newMul.expand();
                results.push(newMul);
              }
              term.splice(1, 1);
              term[0] = (function(func, args, ctor) {
                ctor.prototype = func.prototype;
                var child = new ctor, result = func.apply(child, args);
                return Object(result) === result ? result : child;
              })(Add, results, function(){});
              term[0] = term[0].expand();
            } else if (term[1] instanceof Mul) {
              term[0] = Mul.expandMulAdd(term.splice(1, 1)[0], term[0]);
            } else {
              term[0] = new Mul(term[0], term.splice(1, 1)[0]);
            }
          } else {
            term[0] = new Mul(term[0]);
          }
        }
        if (typeof (_base = term[0]).sort === "function") {
          _base.sort();
        }
        return term[0];
      };

      Mul.prototype.simplify = function() {
        var base, c, child, constantterm, found, i, index, liketerm, liketerms, newMul, newPow, numerical, power, term, terms, _base, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
        terms = [];
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child.simplify != null) {
            child = child.simplify();
          } else if (child.copy != null) {
            child = child.copy();
          }
          terms.push(child);
        }
        liketerms = [];
        constantterm = null;
        i = 0;
        while (i < terms.length) {
          term = terms[i];
          if (term instanceof Mul) {
            child = terms.splice(i, 1)[0];
            _ref1 = child.children;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              c = _ref1[_j];
              terms.push(c);
            }
            i -= 1;
          } else if (term instanceof terminals.Constant) {
            if (constantterm != null) {
              constantterm = constantterm.multiply(term);
            } else {
              constantterm = term.copy();
            }
          } else if (term instanceof Pow) {
            base = term.children.left;
            power = term.children.right;
            found = false;
            for (index = _k = 0, _len2 = liketerms.length; _k < _len2; index = ++_k) {
              liketerm = liketerms[index];
              if (liketerm[0].equals != null) {
                if (liketerm[0].equals(base)) {
                  liketerms[index][1] = new Add(liketerm[1], power);
                  liketerms[index][1] = liketerms[index][1].simplify();
                  if (((_ref2 = liketerms[index][1].children) != null ? _ref2.length : void 0) === 1) {
                    liketerms[index][1] = liketerms[index][1].children[0];
                  }
                  found = true;
                }
              } else if (liketerm[0] === base) {
                liketerms[index][1] = new Add(liketerm[1], power);
                liketerms[index][1] = liketerms[index][1].simplify();
                if (((_ref3 = liketerms[index][1].children) != null ? _ref3.length : void 0) === 1) {
                  liketerms[index][1] = liketerms[index][1].children[0];
                }
                found = true;
              }
            }
            if (!found) {
              liketerms.push([base, power]);
            }
          } else {
            found = false;
            for (index = _l = 0, _len3 = liketerms.length; _l < _len3; index = ++_l) {
              liketerm = liketerms[index];
              if (liketerm[0].equals != null) {
                if (liketerm[0].equals(term)) {
                  liketerms[index][1] = new Add(liketerm[1], new terminals.Constant("1"));
                  liketerms[index][1] = liketerms[index][1].simplify();
                  if (((_ref4 = liketerms[index][1].children) != null ? _ref4.length : void 0) === 1) {
                    liketerms[index][1] = liketerms[index][1].children[0];
                  }
                  found = true;
                }
              } else if (liketerm[0] === term) {
                liketerms[index][1] = new Add(liketerm[1], new terminals.Constant("1"));
                liketerms[index][1] = liketerms[index][1].simplify();
                if (((_ref5 = liketerms[index][1].children) != null ? _ref5.length : void 0) === 1) {
                  liketerms[index][1] = liketerms[index][1].children[0];
                }
                found = true;
              }
            }
            if (!found) {
              liketerms.push([term, new terminals.Constant("1")]);
            }
          }
          i += 1;
        }
        if ((constantterm != null ? typeof constantterm.evaluate === "function" ? constantterm.evaluate() : void 0 : void 0) === 0) {
          return new terminals.Constant("0");
        }
        newMul = null;
        for (_m = 0, _len4 = liketerms.length; _m < _len4; _m++) {
          liketerm = liketerms[_m];
          if ((typeof (_base = liketerm[1]).evaluate === "function" ? _base.evaluate() : void 0) !== 1) {
            newPow = new Pow(liketerm[0], liketerm[1]);
            newPow = newPow.simplify();
          } else {
            newPow = liketerm[0];
          }
          if (newMul != null) {
            newMul.children.push(newPow);
          } else {
            newMul = new Mul(newPow);
          }
        }
        if (newMul == null) {
          return constantterm;
        }
        if ((constantterm != null) && constantterm.evaluate() !== 1) {
          newMul.children.push(constantterm);
        }
        newMul.sort();
        numerical = true;
        _ref6 = newMul.children;
        for (_n = 0, _len5 = _ref6.length; _n < _len5; _n++) {
          child = _ref6[_n];
          if (!(child instanceof terminals.Constant)) {
            numerical = false;
            break;
          }
        }
        if (numerical) {
          return newMul.simplifyConstants();
        }
        if (newMul.children.length !== 1) {
          return newMul;
        }
        return newMul.children[0];
      };

      Mul.prototype.sort = function() {
        var child, _i, _len, _ref;
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (typeof child.sort === "function") {
            child.sort();
          }
        }
        return this.children.sort(compare);
      };

      Mul.prototype.expandAndSimplify = function() {
        var expr;
        expr = this.expand();
        if (expr.simplify != null) {
          return expr.simplify();
        }
        return expr;
      };

      Mul.prototype.solve = function(variable) {
        var child, error, expr, _i, _len, _ref;
        expr = this.expandAndSimplify();
        if (expr instanceof terminals.Terminal) {
          if (expr instanceof terminals.Variable && expr.label === variable) {
            return [new terminals.Constant("0")];
          } else {
            throw new AlgebraError(expr.toString(), variable);
          }
        }
        if (!(expr instanceof Mul)) {
          return expr.solve(variable);
        }
        _ref = expr.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable && child.label === variable) {
            return [new terminals.Constant("0")];
          } else if (child instanceof Pow) {
            try {
              return child.solve(variable);
            } catch (_error) {
              error = _error;
              if (error instanceof AlgebraError) {
                continue;
              } else {
                throw error;
              }
            }
          }
        }
        throw new AlgebraError(expr.toString(), variable);
      };

      Mul.prototype.getAllVariables = function() {
        var child, childVariables, outVariables, variable, variables, _i, _j, _len, _len1, _ref;
        variables = {};
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable) {
            variables[child.label] = true;
          } else if (child.getAllVariables != null) {
            childVariables = child.getAllVariables();
            for (_j = 0, _len1 = childVariables.length; _j < _len1; _j++) {
              variable = childVariables[_j];
              variables[variable] = true;
            }
          }
        }
        outVariables = [];
        for (variable in variables) {
          outVariables.push(variable);
        }
        return outVariables;
      };

      Mul.prototype.replaceVariables = function(replacements) {
        var child, index, _i, _len, _ref, _results;
        _ref = this.children;
        _results = [];
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          child = _ref[index];
          if (child instanceof terminals.Variable && child.label in replacements) {
            _results.push(this.children[index].label = replacements[child.label]);
          } else if (child.replaceVariables != null) {
            _results.push(child.replaceVariables(replacements));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };

      Mul.prototype.sub = function(substitutions) {
        var child, children, newMul, variable, _i, _len, _ref;
        for (variable in substitutions) {
          if (!(substitutions[variable] instanceof terminals.Terminal || substitutions[variable] instanceof nodes.BasicNode)) {
            substitutions[variable] = new terminals.Constant(substitutions[variable]);
          }
        }
        children = [];
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable && child.label in substitutions) {
            children.push(substitutions[child.label].copy());
          } else if (child.sub != null) {
            children.push(child.sub(substitutions));
          } else {
            children.push(child.copy());
          }
        }
        newMul = (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(Mul, children, function(){});
        newMul = newMul.expandAndSimplify();
        return newMul;
      };

      Mul.prototype.substituteExpression = function(sourceExpression, variable, equivalencies) {
        var child, children, _i, _len, _ref, _results;
        if (equivalencies == null) {
          equivalencies = null;
        }
        children = [];
        _ref = this.children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (child instanceof terminals.Variable && child.label === variable) {
            _results.push(children.push(sourceExpression.copy()));
          } else if (child.substituteExpression != null) {
            _results.push(children.push(substituteExpression(sourcex, variable, equivalencies)));
          } else {
            _results.push(children.push(child.copy()));
          }
        }
        return _results;
      };

      Mul.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        _ref = generateInfo.getMathMLInfo(equationID, expression, equality), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
        if (!topLevel) {
          html = "";
          closingHTML = "";
        } else {
          closingHTML = "</math></div>";
        }
        return html + "<mrow>" + this.children.map(function(child) {
          return "<mfenced>" + child.toMathML(equationID, expression) + "</mfenced>";
        }).join("<mo>&middot;</mo>") + "</mrow>" + closingHTML;
      };

      Mul.prototype.toHTML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, mathClass, mathID, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        _ref = generateInfo.getHTMLInfo(equationID, expression, equality), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
        if (!topLevel) {
          html = "";
          closingHTML = "";
        } else {
          closingHTML = "</div>";
        }
        return html + this.children.map(function(child) {
          return "(" + child.toHTML() + ")";
        }).join("&middot;") + closingHTML;
      };

      Mul.prototype.toLaTeX = function() {
        return this.children.map(function(child) {
          return "\\left(" + child.toLaTeX() + "\\right)";
        }).join("\\cdot");
      };

      return Mul;

    })(nodes.RoseNode);
    Pow = (function(_super) {
      __extends(Pow, _super);

      function Pow() {
        var args, base, power, _ref;
        base = arguments[0], power = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
        if (!((base != null) && (power != null))) {
          throw new Error("Pow nodes must have two children.");
        }
        if (args.length > 0) {
          throw new Error("Pow nodes must have two children.");
        }
        this.cmp = -3;
        _ref = parseArgs(base, power), base = _ref[0], power = _ref[1];
        Pow.__super__.constructor.call(this, "**", base, power);
      }

      Pow.prototype.copy = function() {
        return new Pow((this.children.left.copy != null ? this.children.left.copy() : this.children.left), (this.children.right.copy != null ? this.children.right.copy() : this.children.right));
      };

      Pow.prototype.sort = function() {
        var _base, _base1;
        if (typeof (_base = this.children.left).sort === "function") {
          _base.sort();
        }
        return typeof (_base1 = this.children.right).sort === "function" ? _base1.sort() : void 0;
      };

      Pow.prototype.equals = function(b) {
        if (!(b instanceof Pow)) {
          return false;
        }
        if (this.children.left.equals != null) {
          if (!this.children.left.equals(b.children.left)) {
            return false;
          }
        } else {
          if (this.children.left !== b.children.left) {
            return false;
          }
        }
        if (this.children.right.equals != null) {
          if (!this.children.right.equals(b.children.right)) {
            return false;
          }
        } else {
          if (this.children.right !== b.children.right) {
            return false;
          }
        }
        return true;
      };

      Pow.prototype.compareSameType = function(b) {
        var c;
        c = compare(this.children.left, b.children.left);
        if (c !== 0) {
          return c;
        } else {
          return compare(this.children.right, b.children.right);
        }
      };

      Pow.prototype.expand = function() {
        var child, children, i, index, left, newMul, newPow, right, _i, _j, _len, _ref, _ref1;
        if (this.children.left.expand != null) {
          left = this.children.left.expand();
        } else if (this.children.left.copy != null) {
          left = this.children.left.copy();
        } else {
          left = this.children.left;
        }
        if (this.children.right.expand != null) {
          right = this.children.right.expand();
        } else if (this.children.right.copy != null) {
          right = this.children.right.copy();
        } else {
          right = this.children.right;
        }
        if (left.children != null) {
          if (left instanceof Pow) {
            left.children.right = new Mul(left.children.right, right);
            left.expand();
          } else if (left instanceof Mul) {
            _ref = left.children;
            for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
              child = _ref[index];
              newPow = new Pow(child, right);
              newPow = newPow.expand();
              left.children[index] = newPow;
            }
          } else if (left instanceof Add) {
            if (right instanceof terminals.Constant && right.evaluate() % 1 === 0 && right.evaluate() > 0) {
              children = [];
              for (i = _j = 1, _ref1 = right.evaluate(); 1 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 1 <= _ref1 ? ++_j : --_j) {
                children.push(left);
              }
              newMul = (function(func, args, ctor) {
                ctor.prototype = func.prototype;
                var child = new ctor, result = func.apply(child, args);
                return Object(result) === result ? result : child;
              })(Mul, children, function(){});
              newMul = newMul.expand();
              left = newMul;
            } else {
              left = new Pow(left, right);
            }
          }
          return left;
        } else {
          return new Pow(left, right);
        }
      };

      Pow.prototype.simplify = function() {
        var left, newPow, power, right;
        if (this.children.left.simplify != null) {
          left = this.children.left.simplify();
        } else if (this.children.left.copy != null) {
          left = this.children.left.copy();
        } else {
          left = this.children.left;
        }
        if (this.children.right.simplify != null) {
          right = this.children.right.simplify();
        } else if (this.children.right.copy != null) {
          right = this.children.right.copy();
        } else {
          right = this.children.right;
        }
        if ((typeof right.evaluate === "function" ? right.evaluate() : void 0) === 1) {
          return left;
        } else if ((typeof left.evaluate === "function" ? left.evaluate() : void 0) === 1) {
          return left;
        } else if ((typeof right.evaluate === "function" ? right.evaluate() : void 0) === 0) {
          return new terminals.Constant("1");
        } else {
          if (right instanceof terminals.Constant && left instanceof terminals.Constant) {
            return new terminals.Constant(Math.pow(left.evaluate(), right.evaluate()));
          } else if (left instanceof Pow) {
            power = new Mul(left.children.right, right);
            newPow = new Pow(left.children.left, power);
            newPow = newPow.simplify();
            return newPow;
          } else {
            return new Pow(left, right);
          }
        }
      };

      Pow.prototype.expandAndSimplify = function() {
        var expr;
        expr = this.expand();
        if (expr.simplify != null) {
          return expr.simplify();
        }
        return expr;
      };

      Pow.prototype.solve = function(variable) {
        var error, expr, negative, returnables, solution, solutions, _i, _len;
        expr = this.expandAndSimplify();
        if (expr instanceof terminals.Terminal) {
          if (expr instanceof terminals.Variable && expr.label === variable) {
            return [new terminals.Constant("0")];
          } else {
            throw new AlgebraError(expr.toString(), variable);
          }
        }
        if (expr instanceof Pow) {
          if (expr.children.left instanceof terminals.Variable) {
            if (expr.children.left.label === variable) {
              return [new terminals.Constant("0")];
            }
            throw new AlgebraError(expr.toString(), variable);
          } else if (expr.children.left instanceof terminals.Terminal) {
            throw new AlgebraError(expr.toString(), variable);
          } else {
            try {
              solutions = expr.children.left.solve(variable);
            } catch (_error) {
              error = _error;
              throw error;
            }
            if ((expr.children.right.evaluate != null) && expr.children.right.evaluate() % 2 === 0) {
              returnables = [];
              for (_i = 0, _len = solutions.length; _i < _len; _i++) {
                solution = solutions[_i];
                negative = (new Mul(-1, solution)).simplify();
                if (negative.equals != null) {
                  if (!negative.equals(solution)) {
                    returnables.push(negative);
                  }
                  returnables.push(solution);
                } else {
                  if (negative !== solution) {
                    returnables.push(negative);
                  }
                  returnables.push(solution);
                }
              }
              return returnables;
            } else {
              return solutions;
            }
          }
        } else {
          return expr.solve(variable);
        }
      };

      Pow.prototype.sub = function(substitutions) {
        var left, newPow, right, variable;
        for (variable in substitutions) {
          if (!(substitutions[variable] instanceof terminals.Terminal || substitutions[variable] instanceof nodes.BasicNode)) {
            substitutions[variable] = new terminals.Constant(substitutions[variable]);
          }
        }
        left = null;
        right = null;
        if (this.children.left instanceof terminals.Variable && this.children.left.label in substitutions) {
          left = substitutions[this.children.left.label].copy();
        } else if (this.children.left.sub != null) {
          left = this.children.left.sub(substitutions);
        } else {
          left = this.children.left.copy();
        }
        if (this.children.right instanceof terminals.Variable && this.children.right.label in substitutions) {
          right = substitutions[this.children.right.label].copy();
        } else if (this.children.right.sub != null) {
          right = this.children.right.sub(substitutions);
        } else {
          right = this.children.right.copy();
        }
        newPow = new Pow(left, right);
        newPow = newPow.expandAndSimplify();
        return newPow;
      };

      Pow.prototype.getAllVariables = function() {
        var leftVariables, outVariables, rightVariables, variable, variables, _i, _j, _len, _len1;
        variables = {};
        if (this.children.left instanceof terminals.Variable) {
          variables[this.children.left.label] = true;
        } else if (this.children.left.getAllVariables != null) {
          leftVariables = this.children.left.getAllVariables();
          for (_i = 0, _len = leftVariables.length; _i < _len; _i++) {
            variable = leftVariables[_i];
            variables[variable] = true;
          }
        }
        if (this.children.right instanceof terminals.Variable) {
          variables[this.children.right.label] = true;
        } else if (this.children.right.getAllVariables != null) {
          rightVariables = this.children.right.getAllVariables();
          for (_j = 0, _len1 = rightVariables.length; _j < _len1; _j++) {
            variable = rightVariables[_j];
            variables[variable] = true;
          }
        }
        outVariables = [];
        for (variable in variables) {
          outVariables.push(variable);
        }
        return outVariables;
      };

      Pow.prototype.replaceVariables = function(replacements) {
        if (this.children.left instanceof terminals.Variable && this.children.left.label in replacements) {
          this.children.left.label = replacements[this.children.left.label];
        } else if (this.children.left.replaceVariables != null) {
          this.children.left.replaceVariables(replacements);
        }
        if (this.children.right instanceof terminals.Variable && this.children.right.label in replacements) {
          return this.children.right.label = replacements[this.children.right.label];
        } else if (this.children.right.replaceVariables != null) {
          return this.children.right.replaceVariables(replacements);
        }
      };

      Pow.prototype.substituteExpression = function(sourceExpression, variable, equivalencies) {
        var left, newPow, right;
        if (equivalencies == null) {
          equivalencies = null;
        }
        left = this.children.left.copy();
        right = this.children.right.copy();
        if (this.children.left instanceof terminals.Variable && this.children.left.label === variable) {
          left = sourceExpression.copy();
        } else if (!(this.children.left instanceof terminals.Terminal)) {
          left = this.children.left.substituteExpression(sourceExpression, variable, equivalencies);
        }
        if (this.children.right instanceof terminals.Variable && this.children.right.label === variable) {
          right = sourceExpression.copy();
        } else if (!(this.children.right instanceof terminals.Terminal)) {
          right = this.children.right.substituteExpression(sourceExpression, variable, equivalencies);
        }
        newPow = new Pow(left, right);
        newPow = newPow.expandAndSimplify();
        return newPow;
      };

      Pow.prototype.toMathML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, innerHTML, mathClass, mathID, right, _base, _base1, _base2, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        _ref = generateInfo.getMathMLInfo(equationID, expression, equality), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
        if (!topLevel) {
          html = "";
          closingHTML = "";
        } else {
          closingHTML = "</math></div>";
        }
        if ((typeof (_base = this.children.right).evaluate === "function" ? _base.evaluate() : void 0) === 1) {
          return html + this.children.left.toMathML(equationID, expression) + closingHTML;
        } else if ((typeof (_base1 = this.children.right).evaluate === "function" ? _base1.evaluate() : void 0) === 0) {
          return html + "<mn>1</mn>" + closingHTML;
        } else {
          innerHTML = "<mfenced>" + (this.children.left.toMathML(equationID, expression)) + "</mfenced>" + (this.children.right.toMathML(equationID, expression));
          innerHTML = "<msup>" + innerHTML + "</msup>";
          if ((typeof (_base2 = this.children.right).evaluate === "function" ? _base2.evaluate() : void 0) < 0) {
            right = this.children.right.copy();
            right = new Mul("-1", right);
            right = right.simplify();
            innerHTML = "<mfrac><mn>1</mn>" + innerHTML + "</mfrac>";
          }
          return html + innerHTML + closingHTML;
        }
      };

      Pow.prototype.toHTML = function(equationID, expression, equality, topLevel) {
        var closingHTML, html, innerHTML, mathClass, mathID, _base, _base1, _ref;
        if (expression == null) {
          expression = false;
        }
        if (equality == null) {
          equality = "0";
        }
        if (topLevel == null) {
          topLevel = false;
        }
        _ref = generateInfo.getHTMLInfo(equationID, expression, equality), mathClass = _ref[0], mathID = _ref[1], html = _ref[2];
        if (!topLevel) {
          html = "";
          closingHTML = "";
        } else {
          closingHTML = "</div>";
        }
        if ((typeof (_base = this.children.right).evaluate === "function" ? _base.evaluate() : void 0) === 1) {
          return html + this.children.left.toHTML() + closingHTML;
        } else if ((typeof (_base1 = this.children.right).evaluate === "function" ? _base1.evaluate() : void 0) === 0) {
          return html + "1" + closingHTML;
        } else {
          innerHTML = "(" + (this.children.left.toHTML()) + ") ** (" + (this.children.right.toHTML()) + ")";
          return html + innerHTML + closingHTML;
        }
      };

      Pow.prototype.toLaTeX = function() {
        var innerLaTeX, right, _base, _base1, _base2;
        if ((typeof (_base = this.children.right).evaluate === "function" ? _base.evaluate() : void 0) === 1) {
          return this.children.left.toLaTeX();
        } else if ((typeof (_base1 = this.children.right).evaluate === "function" ? _base1.evaluate() : void 0) === 0) {
          return "1";
        } else {
          innerLaTeX = "\\left(" + (this.children.left.toLaTeX()) + "\\right)^{" + (this.children.right.toLaTeX()) + "}";
          if ((typeof (_base2 = this.children.right).evaluate === "function" ? _base2.evaluate() : void 0) < 0) {
            right = this.children.right.copy();
            right = new Mul("-1", right);
            right = right.simplify();
            innerLaTeX = "\\frac{1}{" + innerLaTeX + "}";
          }
          return innerLaTeX;
        }
      };

      return Pow;

    })(nodes.BinaryNode);
    compare = function(a, b) {
      /*
      		Order:
      		-6: Constants, by value
      		-5: Symbolic constants, by label
      		-4: Variables, by label
      		-3: Power nodes, by base
      		-2: Multiplication nodes, by first child
      		-1: Addition nodes, by first child
      */

      if ((a.cmp != null) && (b.cmp != null)) {
        if (a.cmp === b.cmp) {
          return a.compareSameType(b);
        } else {
          return (a.cmp - b.cmp) / Math.abs(a.cmp - b.cmp);
        }
      } else {
        return 0;
      }
    };
    return {
      Add: Add,
      Mul: Mul,
      Pow: Pow,
      compare: compare,
      AlgebraError: AlgebraError
    };
  });

}).call(this);

// Generated by CoffeeScript 1.6.3
/* Coffeequate - http://github.com/MatthewJA/Coffeequate*/


(function() {
  require.config({
    baseUrl: "./"
  });

  define('coffeequate',["Equation", "operators", "terminals", "parse"], function(Equation, operators, terminals, parse) {
    return {
      Equation: Equation,
      tree: {
        operators: operators,
        terminals: terminals
      },
      parse: parse
    };
  });

}).call(this);

require(["coffeequate"]);
    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('coffeequate');
}));