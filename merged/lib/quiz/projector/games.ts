/** Importing this file registers all five game modules. */
import './reducers/empire';
import './reducers/boss';
import './reducers/escape';
import './reducers/vault';
import './reducers/ladder';
export { reduce, moduleFor, initCore } from './engine';
