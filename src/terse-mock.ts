const ANY = Symbol('__ANY__');
const ANY_ARGS = argsToString([ANY]);
const MOCK_PROXY_TRAVERSED_PATH = '__MOCK_PROXY_TRAVERSED_PATH__';
const MOCK_PROXY_NAME = '__MOCK_PROXY_NAME__';
const MOCK_PROXY_TO_OBJECT = '__MOCK_PROXY_TO_OBJECT__';
const RESET_MOCK_PROXY = '__RESET_MOCK_PROXY__';
const SET_MOCK_PROXY_RETURN_VALUES = '__SET_MOCK_PROXY_RETURN_VALUES__';
const EXTERNAL_MOCK = Symbol('EXTERNAL_MOCK');
const ARGS_TO_RETURN_VALUES = Symbol('ARGS_TO_RETURN_VALUES');
const IS_A_MOCK_PROXY = Symbol('IS_A_MOCK_PROXY');
const IS_A_SPY = Symbol('IS_A_SPY');
const ORIGINAL_FUNCTION = Symbol('ORIGINAL_FUNCTION');
const IS_A_MOCKED_FUNCTION = Symbol('IS_A_MOCKED_FUNCTION');

function getOrAdd(obj: any, prop: ObjectPropertyType, val: any = {}) {
  if (!obj.hasOwnProperty(prop)) {
    obj[prop] = val;
  }
  return obj[prop];
}

function toString(data: any, simplify: boolean = false) {
  if (isArray(data)) {
    if (data.length === 0) {
      return '[]';
    }
    return simplify ? '[...]' : '[' + data.map((item) => toString(item)).join(', ') + ']';
  }
  if (isObject(data)) {
    const props = Object.keys(data);
    if (props.length === 0) {
      return '{}';
    }
    return simplify ? '{...}' : '{' + props.map((key) => key + ': ' + toString(data[key])).join(', ') + '}';
  }
  if (isFunction(data)) {
    if (isMockProxy(data)) {
      const unmocked = tunmock(data);
      if (isString(unmocked)) {
        return unmocked;
      }
      if (simplify) {
        return data[MOCK_PROXY_NAME];
      }
      return toString(unmocked);
    }
//    if (simplify) { // Uncomment this 'if' to get full function text if not simplified.
    const found = String(data).match(/(\S*)\s*\(/);
    if (!found || found[1] === 'function') {
      return 'function';
    }
    const name = found[1];
    return name ? ('function ' + name) : 'arrow function';
//    }
//    return String(data);
  }
  if (isString(data)) {
    return '"' + data + '"';
  }
  return String(data);
}

function isString(data) {
  return typeof data === 'string';
}

function isFunction(data) {
  return typeof data === 'function';
}

function isScalar(data) {
  return !isObjectOrArrayOrClass(data) && !isFunction(data);
}

function isObject(data) {
  return isObjectOrClass(data) && (!data.constructor || data.constructor.name === 'Object'); // !data.constructor handles Object.create(null)
}

function isInstanceofObject(data: any) {
  // jest.fn() instances also fall here.
  return data instanceof Object;
}

function isArray(data) {
  return Array.isArray(data);
}

function isMockProxy(data: any) {
  return data && data[IS_A_MOCK_PROXY] === true;
}

function isSpy(data: any) {
  return data && hasSymbol(data, IS_A_SPY);
}

function isMockedFunction(data: any) {
  return data && hasSymbol(data, IS_A_MOCKED_FUNCTION);
}

function isInitCouple(data) {
  return data.length === 2 && isFunction(data[0]);
}

function isClass(data: any) {
  return isObjectOrClass(data) && data.constructor && data.constructor.name !== 'Object';
}

function isObjectOrClass(data) {
  return isObjectOrArrayOrClass(data) && !isArray(data);
}

function isObjectOrArrayOrClass(data) {
  return typeof data === 'object' && data !== null;
}

function hasSymbol(obj, sym: symbol) {
  return Object.getOwnPropertySymbols(obj).includes(sym);
}

function argsToString(args: any[], simplify: boolean = false) {
  return '(' + args.map((arg) => toString(arg, simplify)).join(', ') + ')';
}

type PropMapperType = (val, prop?) => Object;

function deepClone(source: any) {
  if (isObject(source)) {
    return shallowMergeFromTo(source, {}, (val) => deepClone(val));
  }
  // if (isArray(source)) { // Is not required for now. Commented for 100% coverage.
  //   return source.map((item) => deepClone(item));
  // }
  return source;
}

function deepCloneAndSpyify(source: any, pathBuilder: PathBuilder, externalMock?: IExternalMock, thisArg = null) {
  if (isMockProxy(source)) {
    return source;
  }
  if (isObject(source)) {
    return shallowMergeFromTo(source, {}, (val, prop) => deepCloneAndSpyify(val, pathBuilder.addProp(prop), externalMock, source));
  }
  if (isArray(source)) {
    return source.map((item, index) => deepCloneAndSpyify(item, pathBuilder.addProp(index), externalMock, source));
  }
  if (isFunction(source)) {
    if (!isInstanceofObject(source)) {
      // Special case for entities that has typeof === 'function' but that are not instanceof Object.
      // jest.fn() instances fall here, we make this check to return jest.fn() instance as is,
      // otherwise we may end up with problems like incorrect results of jest matchers or stack overflows.
      return externalMock ? createSpy(pathBuilder, source, externalMock) : source;
    }
    const result = createSpy(pathBuilder, source.bind(thisArg), externalMock); // TODO: test this binding
    shallowMergeFromTo(source, result, (val) => deepCloneAndSpyify(val, pathBuilder, externalMock, source));
    return result;
  }

  return source;
}

function shallowMergeFromTo(from: Object, to: Object, mapper: PropMapperType = (val) => val, except: (string|symbol)[] = []) {
  for (const [prop, val] of Object.entries(from)) {
    if (!except.includes(prop)) {
      to[prop] = mapper(val, prop);
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(from) ) {
    if (!except.includes(symbol)) {
      to[symbol] = mapper(from[symbol], symbol);
    }
  }
  return to;
}

// function deepMergeFromTo(from, to) {
//   if (!isInstanceofObject(to) || !isInstanceofObject(from)) {
//     return from;
//   }
//   return shallowMergeFromTo(from, to, (val, prop) => deepMergeFromTo(val, to[prop]));
// }

const defaultProxyTarget = () => undefined;

export interface IExternalMock {
  create: () => any;
}

function createMockFunction(thisArg: any, externalMock?: IExternalMock, defaultReturnSetter: (context: IMockFunctionContext) => any = () => undefined) {
  const context: IMockFunctionContext = {
    argsToReturnValues: {},
  };

  const mockFunction = function (...args: any[]) {
    const keyFromArgs = argsToString(args);
    if (externalMock) {
      mockFunction[EXTERNAL_MOCK].apply(thisArg, args);
    }
    return context.argsToReturnValues.hasOwnProperty(keyFromArgs) ? context.argsToReturnValues[keyFromArgs] : defaultReturnSetter(context);
  };

  if (externalMock) {
    mockFunction[EXTERNAL_MOCK] = externalMock.create();
  }
  mockFunction[IS_A_MOCKED_FUNCTION] = context.argsToReturnValues;
  mockFunction[ARGS_TO_RETURN_VALUES] = context.argsToReturnValues;
  return mockFunction;
}

function createSpy(pathBuilder: PathBuilder, originalFunction: any, externalMock?: IExternalMock) {
  const spy = function () {
    totalCallLog.push(pathBuilder.addCall([...arguments]));
    if (externalMock) {
      spy[EXTERNAL_MOCK](...arguments);
    }
    return originalFunction(...arguments);
  };
  shallowMergeFromTo(originalFunction, spy);
  if (externalMock) {
    spy[EXTERNAL_MOCK] = externalMock.create();
  }
  spy[IS_A_SPY] = true;
  spy[ORIGINAL_FUNCTION] = originalFunction;
  return spy;
}

interface IMockFunctionContext {
  //argsToReturnValues: Map<string, any>;
  argsToReturnValues: { [key: string]: any };
}

export interface IOptions {
  automock: boolean;
  simplifiedOutput: boolean;
  name: string;
  externalMock?: IExternalMock;
}

export interface IMockInfo {
  externalMock: any;
}

// TODO: implement mock once.
// interface IMockOnce {
//   remainingTriggerCounter: number;
//   parent: any;
// }

type CallInfo = {
  this: any;
  args: any[];
}

type ObjectPropertyType = string | number | symbol;

interface IStubInitializationProxyContext {
  stubRef: any;
  prevStubRef: any;
  prevProp: ObjectPropertyType;
  stubReplacement: any;
  pathBuilder: PathBuilder;
};

type StringDictionary = { [key: string]: string };

class Undefinable {
  private hasValue_: boolean = false;
  private value_: any;

  constructor(value?: any) {
    if (arguments.length > 0) {
      this.setValue(value);
    }
  }

  setValue(value: any) {
    this.value_ = value;
    this.hasValue_ = true;
  }

  hasValue() {
    return this.hasValue_;
  }

  getValue() {
    return this.value_;
  }
}

interface ITreeNode {
  // TODO: make arguments CallInfo + PathBuilder? or just CallInfo and calculate keyFromArgs by PathBuilder static method
  linkChildViaArgs: (thisArg: any, args: any[], keyFromArgs: ObjectPropertyType, pathToChild: string) => void;
  getArgsToChildPaths(): StringDictionary;
  linkChildViaProp: (prop: ObjectPropertyType, pathToChild: string) => void;
  getPropsToChildPaths(): StringDictionary;
  getArgsToChildPaths(): StringDictionary;
  getValue(): any;
  isFinal(): boolean;
  isTemp(): boolean;
  hasBeenCalled(): boolean;
  hasValue(): boolean;
  toMockFunction(externalMock?: IExternalMock): () => any;
}

class PathBuilder {
  private path_: string  = '';
  private latestPathChunk_: ObjectPropertyType  = '';
  private pathToBeShown_ = '';
  private options_: IOptions;

  // TODO: options -> simplified output
  constructor(path: string, pathToBeShown: string, options: IOptions) {
    this.path_ = path;
    this.pathToBeShown_ = pathToBeShown;
    this.options_ = options;
  }

  public addCall(args: any[]): PathBuilder {
    const latestPathChunk = argsToString(args);
    const pathToBeShownChunk = !this.options_.simplifiedOutput ? latestPathChunk : argsToString(args, true);
    const pathBuilderClone = new PathBuilder(
      this.path_ + latestPathChunk,
      this.pathToBeShown_ + pathToBeShownChunk,
      this.options_);
    pathBuilderClone.latestPathChunk_ = latestPathChunk;
    return pathBuilderClone;
  }

  public addProp(prop: ObjectPropertyType): PathBuilder {
    const latestPathChunkStringied = prop.toString();
    const latestPathChunkWithSeparators = typeof prop === 'symbol' ? '[' + latestPathChunkStringied + ']' : '.' + latestPathChunkStringied;
    const pathBuilderClone = new PathBuilder(
      this.path_ + latestPathChunkWithSeparators,
      this.pathToBeShown_ ? this.pathToBeShown_ + latestPathChunkWithSeparators : latestPathChunkStringied,
      this.options_);
    pathBuilderClone.latestPathChunk_ = prop;
    return pathBuilderClone;
  }

  get path() {
    return this.path_;
  }

  get pathToBeShown() {
    return this.pathToBeShown_;
  }

  get latestPathChunk() {
    return this.latestPathChunk_;
  }
}

class TreeNode implements ITreeNode {
  protected propsToChildPaths_ = {};
  protected argsToChildPaths_ = {};
  protected isFinal_ = false;
  protected isTemp_ = false;
  protected hasBeenCalled_: boolean = false;
  protected calls_: CallInfo[] = [];
  protected value_ = new Undefinable();

  linkChildViaArgs(thisArg: any, args: any[], keyFromArgs: ObjectPropertyType, pathToChild: string) {
    this.calls_.push({ this: thisArg, args });
    this.argsToChildPaths_[keyFromArgs] = pathToChild;
    this.hasBeenCalled_ = true;
  }

  getArgsToChildPaths() {
    return this.argsToChildPaths_;
  }

  linkChildViaProp(prop: ObjectPropertyType, pathToChild: string) {
    this.propsToChildPaths_[prop] = pathToChild;
  }

  getPropsToChildPaths() {
    return this.propsToChildPaths_;
  }

  hasBeenCalled() {
    return this.hasBeenCalled_;
  }

  hasValue() {
    return this.value_.hasValue();
  }

  getValue() {
    return this.value_.getValue();
  }

  toMockFunction(externalMock?: IExternalMock) {
    const f = createMockFunction({}, externalMock);
    if (externalMock) {
      // Call external mock the number of times the original tm mock was called.
      this.calls_.forEach((call) => f.apply(call.this, call.args));
    }
    return f;
  }

  isFinal() {
    return this.isFinal_;
  }

  isTemp() {
    return this.isTemp_;
  }
}

class TreeNodeTemp extends TreeNode {
  constructor(value: any) {
    super();
    this.isTemp_ = true;
    this.value_.setValue(value);
  }
}

class TreeNodeFinal extends TreeNode {
  constructor(value: any) {
    super();
    this.isFinal_ = true;
    this.value_.setValue(value);
  }
}

class SutMockTree {
  // TODO: describe.
  // Each tree item represents a node
  private tree: { [key: string]: ITreeNode } = {};

  get(path: string): ITreeNode {
    return this.tree[path];
  }

  set(path: string, node: ITreeNode): ITreeNode {
    this.tree[path] = node;
    return node;
  }

  getOrAddOrReplaceTemp(path: string, node: ITreeNode): ITreeNode {
    const existingNode = this.tree[path];
    if (!existingNode || existingNode.isTemp()) {
      return this.set(path, node);
    }
    return existingNode;
  }

  deleteSubtree(path: string = '') {
    if (!path) {
      this.tree = {};
    }
    for (const prop in this.tree) {
      if (prop.length > path.length && (prop.startsWith(path + '.') || prop.startsWith(path + '('))) {
        // By construction: if node index starts with path. or path( then the node is in subtree of node with index = path.
        delete this.tree[prop];
      }
    }
    delete this.tree[path];
  }

  // Converts tree to hierarchy of objects and functions based on node paths and node values.
  toObject(path: string, externalMock?: IExternalMock): Undefinable {
    const node = this.tree[path];
    if (!node) {
      return new Undefinable();
    }
    if (node.hasValue()) {
      return new Undefinable(node.getValue());
    }

    const collectValuesFromChildren = (res: Object, propsOrArgsToChildPaths: StringDictionary) =>
      shallowMergeFromTo(propsOrArgsToChildPaths, res, (val) => this.toObject(val, externalMock).getValue());

    let result = {};
    if (node.hasBeenCalled()) { // node represents something collable.
      result = node.toMockFunction(externalMock);
      collectValuesFromChildren(result[ARGS_TO_RETURN_VALUES], node.getArgsToChildPaths());
    }
    collectValuesFromChildren(result, node.getPropsToChildPaths());

    return new Undefinable(result);
  }
}

let totalCallLog: PathBuilder[] = [];

let totalMocksCounter = 0;

const sutMockTree = new SutMockTree();

//-------------------------------- exports ---------------------------------------
// This function removes all tm proxies from data.
export function tunmock(data) {
  if (!isInstanceofObject(data) || isClass(data)) {
    return data;
  }
  if (isMockProxy(data)) {
    return tunmock(data[MOCK_PROXY_TO_OBJECT]);
  }
  if (isArray(data)) {
    return data.map((item) => tunmock(item))
  }
  if (isSpy(data)) {
    const originalFunction = data[ORIGINAL_FUNCTION];
    shallowMergeFromTo(data, originalFunction, (val) => val, [IS_A_SPY, ORIGINAL_FUNCTION]);
    return originalFunction;
  }
  const result = isFunction(data) ? data : {};
  shallowMergeFromTo(data, result, (val) => tunmock(val));
  return result;
}

export function tinfo(data: any): IMockInfo {
  return {
    externalMock: data[EXTERNAL_MOCK],
  };
}

export function treset(mock?: any) {
  if (mock) {
    mock(RESET_MOCK_PROXY);
    return;
  }
  sutMockTree.deleteSubtree();
  totalCallLog = [];
}

export function tcalls(mock?: any): string[] {
  if (!mock) {
    return totalCallLog.map((call) => call.pathToBeShown);
  }
  const path = mock[MOCK_PROXY_TRAVERSED_PATH];
  return totalCallLog.filter((call) => call.path.startsWith(path)).map((call) => call.pathToBeShown);
}

function applyCouplesToStub(stub: object, initCouples: InitCouple[]) {
  initCouples.forEach(initCouple => {
    const proxyContext: IStubInitializationProxyContext = {
      stubRef: stub,
      prevStubRef: stub,
      prevProp: '',
      stubReplacement: undefined,
      pathBuilder: new PathBuilder('', '', {} as any),
    };

    const initializationProxy = getStubInitializationProxy(proxyContext);

    // Traverse initialization expression.
    initCouple[0](initializationProxy);

    if (proxyContext.prevProp) {
      proxyContext.prevStubRef[proxyContext.prevProp] = initCouple[1];
    } else {
      throw new Error('Cannot replace stab root');
    }
  });
}

export function tset<T = any>(stubOrMock, initCoupleOrCouples: [(mockProxy: T) => any, any] | ([(mockProxy: T) => any, any])[]) {
  const initCouples = (isInitCouple(initCoupleOrCouples) ? [initCoupleOrCouples] : initCoupleOrCouples) as InitCouple[];
  if (isMockProxy(stubOrMock)) {
    stubOrMock(SET_MOCK_PROXY_RETURN_VALUES, initCouples);
  } else {
    applyCouplesToStub(stubOrMock, initCouples);
  }
}

let globalOptions: IOptions = {
  automock: true,
  simplifiedOutput: true,
  name: 'mock',
};

export function tglobalopt(options?: Partial<IOptions>): IOptions {
  if (!options) {
    return globalOptions;
  }
  globalOptions = {...globalOptions, ...deepClone(options)};
  return globalOptions;
}

export type InitCouple<T = any> = [(mockProxy: T) => any, any];
//export type InitTriple = [(mockProxy: any) => any, any, number];
export type InitObject = {[index: string]: unknown};
type InitObjectOrInitCouple<T> = (T extends {} ? Partial<T> : InitCouple<T>) | InitCouple<T>;
export type AnyInitializer = InitObject | InitCouple;
type PartialOptions = Partial<IOptions>;

function getStubInitializationProxy(proxyContext: IStubInitializationProxyContext) {
  const initializationProxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      proxyContext.pathBuilder = proxyContext.pathBuilder.addProp(prop);
      let stubRef = proxyContext.stubRef;
      if (isScalar(stubRef)) { // isScalar(stubRef) is deprecated ?
        stubRef = replaceStub({});
      }
      if (isScalar(stubRef[prop])) {
        stubRef[prop] = {};
      }
      proxyContext.prevStubRef = stubRef;
      proxyContext.prevProp = prop;
      proxyContext.stubRef = stubRef[prop];
      return initializationProxy;
    },
    apply(target, thisArg, args) {
      proxyContext.pathBuilder = proxyContext.pathBuilder.addCall(args);
      const key = proxyContext.pathBuilder.latestPathChunk;
      let stubRef = proxyContext.stubRef;
      if (!isMockedFunction(stubRef)) {
        const stubFunc = createMockFunction(thisArg, undefined, (context) => context.argsToReturnValues[ANY_ARGS]);
        shallowMergeFromTo(stubRef, stubFunc);
        stubRef = replaceStub(stubFunc);
      }
      stubRef = stubRef[ARGS_TO_RETURN_VALUES];
      proxyContext.prevStubRef = stubRef;
      proxyContext.prevProp = key;
      proxyContext.stubRef = getOrAdd(stubRef, key);
      return initializationProxy;
    },
  });

  return initializationProxy;

  function replaceStub(newStub) {
    if (proxyContext.prevProp) {
      proxyContext.prevStubRef[String(proxyContext.prevProp)] = newStub;
    } else {
      proxyContext.stubReplacement = newStub;
    }
    return newStub;
  }
}

interface IMockInitializationProxyContext {
  tree: SutMockTree;
  pathBuilder: PathBuilder;
  stubProxyContext?: IStubInitializationProxyContext;
}

function getMockInitializationProxy(proxyContext: IMockInitializationProxyContext) {
  const proxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      const parentNode = proxyContext.tree.getOrAddOrReplaceTemp(proxyContext.pathBuilder.path, new TreeNode()); // TODO: maybe add initial node on tree creation and use .set() instesad?
      proxyContext.pathBuilder = proxyContext.pathBuilder.addProp(prop); // TODO: create new path builder
      const node = proxyContext.tree.get(proxyContext.pathBuilder.path);
      if (!node) {
        proxyContext.tree.set(proxyContext.pathBuilder.path, new TreeNode()); 
        // TODO: nodes should be linked automatically!
        parentNode.linkChildViaProp(proxyContext.pathBuilder.latestPathChunk, proxyContext.pathBuilder.path);
      }
      return pickProxy();
    },
    apply(target, thisArg, args) {
      // TODO: remove code duplicates, share code from get(target, prop)
      const parentNode = proxyContext.tree.getOrAddOrReplaceTemp(proxyContext.pathBuilder.path, new TreeNode()); // TODO: maybe add initial node on tree creation and use .set() instesad?
      proxyContext.pathBuilder = proxyContext.pathBuilder.addCall(args);
      const node = proxyContext.tree.get(proxyContext.pathBuilder.path);
      if (!node) {
        proxyContext.tree.set(proxyContext.pathBuilder.path, new TreeNode()); 
        // TODO: nodes should be linked automatically!
        parentNode.linkChildViaArgs(thisArg, args, proxyContext.pathBuilder.latestPathChunk, proxyContext.pathBuilder.path);
      }
      return pickProxy();
    },
  });
  return proxy;

  function pickProxy() {
    const node = proxyContext.tree.get(proxyContext.pathBuilder.path);
    if (node.isFinal()) {
      const value = node.getValue();
      const stubProxyContext: IStubInitializationProxyContext = {
        stubRef: value,
        prevStubRef: value,
        prevProp: '',
        stubReplacement: undefined,
        pathBuilder: new PathBuilder('', '', {} as any), // TODO: get rid of any
      };
      proxyContext.stubProxyContext = stubProxyContext;
      return getStubInitializationProxy(stubProxyContext);
    }
    return proxy;
  }
}

function applyCouplesToMock(initCouples: InitCouple[], pathBuilder: PathBuilder, options: IOptions) {
  initCouples.forEach(initCouple => {
    const proxyContext: IMockInitializationProxyContext = {
      tree: sutMockTree,
      pathBuilder: pathBuilder,
    };

    const initializationProxy = getMockInitializationProxy(proxyContext);
    // Traverse initialization expression.
    initCouple[0](initializationProxy);

    const stubProxyContext = proxyContext.stubProxyContext;
    const path = proxyContext.pathBuilder.path;
    if (pathBuilder.path === path) {
      throw new Error('Mocking at root level is not allowed');
    }

    const val = deepCloneAndSpyify(initCouple[1], proxyContext.pathBuilder, options.externalMock);
    if (!stubProxyContext) {
      sutMockTree.deleteSubtree(path); // TODO: shouldn't this be done on sutMockTree.set ?
      sutMockTree.set(path, new TreeNodeFinal(val));
    } else {
      if (stubProxyContext.stubReplacement) {
        sutMockTree.set(path, new TreeNodeFinal(stubProxyContext.stubReplacement));
      } else if (!stubProxyContext.prevProp) {
        sutMockTree.set(path, new TreeNodeFinal(val));
      }
      if (stubProxyContext.prevProp) {
        stubProxyContext.prevStubRef[stubProxyContext.prevProp] = val;
      }
    }
  });
}

function traversePropOrCall(pathBuilder: PathBuilder, options: IOptions, prop?: ObjectPropertyType, callInfo?: CallInfo) {
  const newPathBuilder = callInfo ? pathBuilder.addCall(callInfo.args) : pathBuilder.addProp(prop!);

  const nodeFromSutMockTree = sutMockTree.get(newPathBuilder.path);
  if (nodeFromSutMockTree?.isFinal()) {
    return nodeFromSutMockTree.getValue();
  }
  if (callInfo) {
    const pathBuilderAny = pathBuilder.addCall([ANY]); // TODO: use static function of PathBuilder
    const nodeFromSutMockTree = sutMockTree.get(pathBuilderAny.path); // TODO: reuse code
    if (nodeFromSutMockTree?.isFinal()) {
      return nodeFromSutMockTree.getValue();
    }  
  }

  if (!options.automock) {
    // Stop proxing if automock is false and propertry has not been explicitly mocked.
    return undefined;
  }

  sutMockTree.getOrAddOrReplaceTemp(newPathBuilder.path, new TreeNodeTemp(/*'value from ' + */newPathBuilder.pathToBeShown));
  const parentNode = sutMockTree.getOrAddOrReplaceTemp(pathBuilder.path, new TreeNode()); // TODO: maybe add initial node on tree creation and use .set() instesad because parent node should always exist by construction
  if (callInfo) {
    parentNode.linkChildViaArgs(callInfo.this, callInfo.args, newPathBuilder.latestPathChunk, newPathBuilder.path);
    totalCallLog.push(newPathBuilder);
  } else {
    parentNode.linkChildViaProp(newPathBuilder.latestPathChunk, newPathBuilder.path);
  }

  return getSutProxy(newPathBuilder, options); // TODO: is it possible to return proxy, not getSutProxy? (no, because)
}

function getSutProxy(pathBuilder: PathBuilder, options: IOptions) {
  const path = pathBuilder.path;
  const sutProxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      // Handle special properties.
      switch (prop) {
        case IS_A_MOCK_PROXY: return true;
        case MOCK_PROXY_TRAVERSED_PATH: return path;
        case MOCK_PROXY_NAME: return options.name;
        case MOCK_PROXY_TO_OBJECT:
          const treeAsObject = sutMockTree.toObject(pathBuilder.path, options.externalMock);
          return treeAsObject.hasValue() ? treeAsObject.getValue() : options.name;      
        case 'hasOwnProperty': return () => true;
        case Symbol.toPrimitive: return target as any; // Prevent from 'TypeError: Cannot convert object to primitive value'.
      }

      return traversePropOrCall(pathBuilder, options, prop);
    },

    set(target, prop, value) {
      const newPathBuilder = pathBuilder.addProp(prop);
      const newPath = newPathBuilder.path;

      // Construct/traverse sutMockTree.
      const node = sutMockTree.getOrAddOrReplaceTemp(path, new TreeNode());
      node.getPropsToChildPaths()[newPathBuilder.latestPathChunk.toString()] = newPath; // TODO: tree should do this

      // Value assigned to a node overrides node subtree.
      sutMockTree.deleteSubtree(newPath);
      sutMockTree.set(newPath, new TreeNodeFinal(value));
      return true;
    },

    apply(target, thisArg, args) {
      if (args.length > 0) {
        const firstArg = args[0];
        // Handle special arguments.
        if (firstArg === SET_MOCK_PROXY_RETURN_VALUES) {
          applyCouplesToMock(args[1], pathBuilder, options);
          return sutProxy;
        } else if (firstArg === RESET_MOCK_PROXY) {
          if (sutMockTree.get(path)) {
            sutMockTree.deleteSubtree(path);
            sutMockTree.set(path, new TreeNodeFinal('value from ' + pathBuilder.pathToBeShown));
          }
          totalCallLog = totalCallLog.filter((call) => !call.path.startsWith(path));
          return undefined;
        }
      }

      return traversePropOrCall(pathBuilder, options, undefined, { this: thisArg, args });
    },
  });

  return sutProxy;
}

function parseTmockArgs(nameOrInitOrOptionsArg?: string | InitCouple | AnyInitializer[] | PartialOptions,
  initOrOptionsArg?: InitCouple | AnyInitializer[] | PartialOptions,
  optionsArg?: PartialOptions)
{
  let name: string | undefined;
  let initializers: AnyInitializer[] | undefined;
  let options: PartialOptions | undefined;
  const multipleOptionsArgsErrorMessage = 'tmock: multiple options arguments not allowed';
  if (nameOrInitOrOptionsArg) {
    if (isString(nameOrInitOrOptionsArg)) {
      name = nameOrInitOrOptionsArg as string;
    } else if (isArray(nameOrInitOrOptionsArg)) {
      initializers = getInitializers(nameOrInitOrOptionsArg);
    } else {
      options = nameOrInitOrOptionsArg as PartialOptions;
    }
  }
  if (initOrOptionsArg) {
    if (isArray(initOrOptionsArg)) {
      if (initializers) {
        throw new Error('tmock: multiple initializer arguments not allowed');
      }
      initializers = getInitializers(initOrOptionsArg);
    } else {
      if (options) {
        throw new Error(multipleOptionsArgsErrorMessage);
      }
      options = initOrOptionsArg as PartialOptions;
    }
  }
  if (optionsArg) {
    if (options) {
      throw new Error(multipleOptionsArgsErrorMessage);
    }
    options = optionsArg;
  }
  return { name, initializers, options };

  function getInitializers(arg): AnyInitializer[] {
    // If first array element is a function then it is an Initializer. Put it to array to create Initializers shape.
    return (isInitCouple(arg) ? [arg] : arg) as AnyInitializer[];
  }
}

export function tmock<T = any>(
  nameOrSetupOrOptionsArg?: string | InitObjectOrInitCouple<T>[] | PartialOptions,
  setupOrOptionsArg?: InitObjectOrInitCouple<T>[] | PartialOptions,
  optionsArg?: PartialOptions)
{
  const parsedArgs = parseTmockArgs(nameOrSetupOrOptionsArg, setupOrOptionsArg, optionsArg);

  const options: IOptions = {
    ...globalOptions,
    ...parsedArgs.options,
  };
  if (parsedArgs.name) {
    options.name = parsedArgs.name;
  }

  const path = `__ROOT${totalMocksCounter++}__`;
  const pathBuilder = new PathBuilder(path, options.name, options);

  const initCouples: InitCouple[] =
    parsedArgs.initializers?.filter(initializer => isArray(initializer) && initializer.length === 2) as InitCouple[] || [];

  const initObject = parsedArgs.initializers?.find(initializer => isObject(initializer)) || {};
  // Make init couples from init object.
  for (const [prop, val] of Object.entries(initObject)) {
    initCouples.unshift([(p) => p[prop], val]);
  }

  const sutMockProxy = getSutProxy(pathBuilder, options);

  if (initCouples.length) {
    tset(sutMockProxy, initCouples);
  }

  return sutMockProxy;
}

export function tstub<T = any>(initializer: InitObjectOrInitCouple<T> | InitObjectOrInitCouple<T>[]) {
  let initializers: (InitObject | InitCouple)[];
  if (!isArray(initializer)) {
    initializers = [initializer as InitObject];
  } else if (isInitCouple(initializer)) {
    initializers = [initializer as InitCouple];
  } else {
    initializers = initializer as (InitObject | InitCouple)[];
  }
  const initCouples: InitCouple[] = initializers.filter(initializer => isInitCouple(initializer)) as InitCouple[] | [];
  const stub = initializers.find(initializer => isObject(initializer));
  const stubCopy = deepClone(stub) || {};

  if (initCouples) {
    tset(stubCopy, initCouples);
  }

  return stubCopy;
}

export const tm = {
  ANY: ANY,
  mock: tmock,
  stub: tstub,
  set: tset,
  reset: treset,
  unmock: tunmock,
  info: tinfo,
  calls: tcalls, // make proxy specially handled functions like proxy.tcalls ?
  globalopt: tglobalopt,
  // targ = { topt: ..., tmap: ..., tstub: ...}
};