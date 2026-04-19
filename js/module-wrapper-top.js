// Taken from https://github.com/umdjs/umd/blob/master/templates/returnExports.js
// (c) by The UMD contributors
// MIT License: https://github.com/umdjs/umd/blob/master/LICENSE.md
(function (root, factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory.bind(root, root));
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory.call(root, root);
    } else {
        // Browser globals (root is window)
        root.SocialCalc = factory.call(root, root);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (window) {
"use strict";
