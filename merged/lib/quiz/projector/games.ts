/** Importing this file registers all five game modules. */
import './reducers/empire';
import './reducers/boss';
import './reducers/escape';
import './reducers/vault';
import './reducers/ladder';
import './reducers/auction';
import './reducers/territory';
import './reducers/factory';
import './reducers/pirate';
import './reducers/showdown';
export { reduce, moduleFor, initCore } from './engine';
