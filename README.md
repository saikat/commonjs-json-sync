This is originally forked from sayrer's JSON sync.  See http://blog.mozilla.com/rob-sayre/2008/02/15/restful-partial-updates/ for more information.  I have modified it to remove the dependency on MochiKit and also to make it a CommonJS loadable module.

TODO: 
* Cleanup the exports in sync.js.  I export a bunch of internal functions so that I could get the tests running.  I should do this more elegantly (by wrapping it all in an object, for example).