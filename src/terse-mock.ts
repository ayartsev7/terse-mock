const MOCK_PROXY_PATHBUILDER = Symbol('MOCK_PROXY_PATHBUILDER');
const MOCK_PROXY_NAME = Symbol('MOCK_PROXY_NAME');
const MOCK_PROXY_TO_OBJECT = Symbol('MOCK_PROXY_TO_OBJECT');
const RESET_MOCK_PROXY = Symbol('RESET_MOCK_PROXY');
const SET_MOCK_PROXY_RETURN_VALUES = Symbol('SET_MOCK_PROXY_RETURN_VALUES');
const EXTERNAL_MOCK = Symbol('EXTERNAL_MOCK');
const ARGS_TO_RETURN_VALUES = Symbol('ARGS_TO_RETURN_VALUES');
const IS_A_MOCK_PROXY = Symbol('IS_A_MOCK_PROXY');
const IS_A_SPY = Symbol('IS_A_SPY');
const ORIGINAL_FUNCTION = Symbol('ORIGINAL_FUNCTION');
const IS_A_MOCKED_FUNCTION = Symbol('IS_A_MOCKED_FUNCTION');
export const TM_ANY = Symbol('TM_ANY');
const ANY_ARGS = argsToString([TM_ANY]);

function getOrAddObjPropVal(obj: any, prop: ObjectPropertyType, val: any = {}) {
  if (!obj.hasOwnProperty(prop)) {
    obj[prop] = val;
  }
  return obj[prop];
}

function functionToString(data: any): string {
//    if (simplify) { // Uncomment this 'if' to get full function text if not simplified.
  const found = String(data).match(/(\S*)\s*\(/);
  if (!found || found[1] === 'function') {
    return 'function';
  }
  const name = found[1];
  let text = 'arrow function';
  if (name) {
    if (globalOptions.exposeFunctionNames) {
      text = 'function ' + name;
    } else {
      text = 'function';
    }
  }
  return text;
//    }
//    return String(data);
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
    return functionToString(data);
  }
  if (isString(data)) {
    return globalOptions.quoteSymbol + data + globalOptions.quoteSymbol;
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
function deepCloneAndSpyify(_source: any, _pathBuilder: PathBuilder, _externalMock?: IExternalMock, _thisArg = null) {
  const visitedObjects: any[] = [];
  return deepCloneAndSpyifyInternal(_source, _pathBuilder, _externalMock, _thisArg);

  function deepCloneAndSpyifyInternal(source: any, pathBuilder: PathBuilder, externalMock: IExternalMock | undefined, thisArg) {
    if (isMockProxy(source)) {
      return source;
    }
    if (isObject(source)) {
      if (visitedObjects.includes(source)) {
        return source;
      }
      visitedObjects.push(source);
      return shallowMergeFromTo(source, {}, (val, prop) => deepCloneAndSpyifyInternal(val, pathBuilder.withProp(prop), externalMock, source));
    }
    if (isArray(source)) {
      return source.map((item, index) => deepCloneAndSpyifyInternal(item, pathBuilder.withProp(index), externalMock, source));
    }
    if (isFunction(source)) {
      if (!isInstanceofObject(source)) {
        // Special case for entities that has typeof === 'function' but that are not instanceof Object.
        // jest.fn() instances fall here, we make this check to return jest.fn() instance as is,
        // otherwise we may end up with problems like incorrect results of jest matchers or stack overflows.
        return externalMock ? createSpy(pathBuilder, source, externalMock) : source;
      }
      const result = createSpy(pathBuilder, source.bind(thisArg), externalMock); // TODO: test this binding
      shallowMergeFromTo(source, result, (val) => deepCloneAndSpyifyInternal(val, pathBuilder, externalMock, source));
      return result;
    }

    return source;
  }
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

const defaultProxyTarget = () => undefined;

export interface IExternalMock {
  create: () => any;
}

function createMockFunction(thisArg: any, externalMock?: IExternalMock, defaultReturnSetter: (context: MockFunctionContext) => any = () => undefined) {
  const context: MockFunctionContext = {
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
    totalCallLog.push(pathBuilder.withCall([...arguments]));
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

type MockFunctionContext = {
  //argsToReturnValues: Map<string, any>;
  argsToReturnValues: { [key: string]: any };
}

type TmockBaseOptions = {
  automock: boolean;
  simplifiedOutput: boolean;
  externalMock?: IExternalMock;
  exposeFunctionNames: boolean;
}

export type TmockOptions = Partial<TmockBaseOptions>;

export type TmockGlobalOptions = TmockBaseOptions & {
  defaultMockName: string;
  quoteSymbol: string;
  autoValuesPrefix: string;
}

type TmockFullOptions = TmockGlobalOptions & TmockOptions;

export type MockInfo = {
  externalMock: any;
}

// TODO: implement mock times.

class CallInfo {
  private this_: any;
  private args_: any[];

  constructor(thisArg: any, args: any[]) {
    this.this_ = thisArg;
    this.args_ = args;
  }

  public get this() {
    return this.this_;
  }
  public get args() {
    return this.args_;
  }
}

type ObjectPropertyType = string | number | symbol;

type StubInitializationProxyContext = {
  stubRef: any;
  prevStubRef: any;
  prevProp: ObjectPropertyType;
  stubReplacement: any;
  pathBuilder: PathBuilder;
};

type StubWrapper = {
  stub: any;
}

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

class PathBuilder {
  private parentPathBuilder_: PathBuilder;
  private groupId_: string  = '';
  private path_: string  = '';
  private latestPathChunk_: ObjectPropertyType  = '';
  private pathToBeShown_ = '';
  private simplifiedOutputEnabled_: boolean;

  constructor(groupId: string, pathToBeShown: string, simplifiedOutputEnabled: boolean = false) {
    this.groupId_ = groupId;
    this.path_ = '';
    this.pathToBeShown_ = pathToBeShown;
    this.simplifiedOutputEnabled_ = simplifiedOutputEnabled;
  }

  public withCall(args: any[]): PathBuilder {
    const latestPathChunk = argsToString(args);
    const pathToBeShownChunk = !this.simplifiedOutputEnabled_ ? latestPathChunk : argsToString(args, true);
    const newPathBuilder = new PathBuilder(
      this.groupId_,
      this.pathToBeShown_ + pathToBeShownChunk,
      this.simplifiedOutputEnabled_);
    newPathBuilder.path_ = this.path_ + latestPathChunk;
    newPathBuilder.latestPathChunk_ = latestPathChunk;
    newPathBuilder.parentPathBuilder_ = this;
    return newPathBuilder;
  }

  public withProp(prop: ObjectPropertyType): PathBuilder {
    const latestPathChunkStringified = prop.toString();
    const latestPathChunkWithSeparators = typeof prop === 'symbol' ? '[' + latestPathChunkStringified + ']' : '.' + latestPathChunkStringified;
    const newPathBuilder = new PathBuilder(
      this.groupId_,
      this.pathToBeShown_ ? this.pathToBeShown_ + latestPathChunkWithSeparators : latestPathChunkStringified,
      this.simplifiedOutputEnabled_);
    newPathBuilder.path_ = this.path_ + latestPathChunkWithSeparators,
    newPathBuilder.latestPathChunk_ = prop;
    newPathBuilder.parentPathBuilder_ = this;
    return newPathBuilder;
  }

  get groupId() {
    return this.groupId_;
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

  get parentPathBuilder() {
    return this.parentPathBuilder_;
  }
}

class MockTreeNode {
  protected propsToChildPaths_ = {};
  protected argsToChildPaths_ = {};
  protected isFinal_ = false;
  protected isTemp_ = false;
  protected calls_: CallInfo[] = [];
  protected value_ = new Undefinable();

  static fromUserNodeAndSutNode(userNode: MockTreeNode, sutNode: MockTreeNode): MockTreeNode {
    if (sutNode.isFinal()) {
      return sutNode;
    }
    if (userNode.isFinal()) {
      return userNode;
    }
    const node = new MockTreeNode();
    node.propsToChildPaths_ = { ...userNode.propsToChildPaths_, ...sutNode.propsToChildPaths_ };
    node.argsToChildPaths_ = { ...userNode.argsToChildPaths_, ...sutNode.argsToChildPaths_ };
    node.isFinal_ = false;
    node.calls_ = [ ...userNode.calls_, ...sutNode.calls_ ];
    if (userNode.isTemp_ && sutNode.isTemp_) {
      node.value_ = sutNode.value_;
    }
    return node;
  }

  linkChildViaArgs(callInfo: CallInfo, pathBuilder: PathBuilder) {
    this.calls_.push(callInfo);
    this.argsToChildPaths_[pathBuilder.latestPathChunk] = pathBuilder.path;
  }

  getArgsToChildPaths() {
    return this.argsToChildPaths_;
  }

  linkChildViaProp(pathBuilder: PathBuilder) {
    this.propsToChildPaths_[pathBuilder.latestPathChunk] = pathBuilder.path;
  }

  getPropsToChildPaths() {
    return this.propsToChildPaths_;
  }

  hasBeenCalled() {
    return this.calls_.length > 0;
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
      this.calls_.forEach((callInfo) => f.apply(callInfo.this, callInfo.args));
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

class TreeNodeTemp extends MockTreeNode {
  constructor(value: any) {
    super();
    this.isTemp_ = true;
    this.value_.setValue(value);
  }
}

class TreeNodeFinal extends MockTreeNode {
  constructor(value: any) {
    super();
    this.isFinal_ = true;
    this.value_.setValue(value);
  }
}

class MockTree {
  // TODO: describe.
  // Each tree item represents a node.
  private tree: { [key: string]: MockTreeNode } = {};

  static fromUserTreeAndSutTree(userTree: MockTree, sutTree: MockTree): MockTree {
    const result = new MockTree();
    for (const prop in userTree.tree) {
      const userNode = userTree.tree[prop];
      const sutNode = sutTree.tree[prop];
      result.tree[prop] = sutNode ? MockTreeNode.fromUserNodeAndSutNode(userNode as MockTreeNode, sutNode as MockTreeNode) : userNode;
    }
    for (const prop in sutTree.tree) {
      if (!result.tree[prop]) {
        result.tree[prop] = sutTree.tree[prop];
      }
    }
    return result;
  }

  getNode(path: string): MockTreeNode {
    return this.tree[path];
  }

  setNode(path: string, node: MockTreeNode): MockTreeNode {
    // this.deleteSubtree(path); // Uncomment to remove dead nodes and significantly slow down the process.
    this.tree[path] = node;
    return node;
  }

  private isNodeNotExistOrIsTempNode(path: string) {
    const existingNode = this.getNode(path);
    return !existingNode || existingNode.isTemp();
  }

  private getOrAddOrReplaceTemp(path: string, node: MockTreeNode): MockTreeNode {
    if (this.isNodeNotExistOrIsTempNode(path)) {
      return this.setNode(path, node);
    }
    return this.getNode(path);
  }

  addChildIfNotExistOrReplaceTemp(childNode: MockTreeNode, childNodePathBuilder: PathBuilder, callInfo?: CallInfo) {
    // If parent node is temp node then replace it with a new node that doesn't have a value.
    // Only leaf nodes can have values.
    const parentNode = this.getOrAddOrReplaceTemp(childNodePathBuilder.parentPathBuilder.path, new MockTreeNode());

    const childNodePath = childNodePathBuilder.path;
    if (this.isNodeNotExistOrIsTempNode(childNodePath)) {
      this.setNode(childNodePath, childNode);
      if (callInfo) {
        parentNode.linkChildViaArgs(callInfo, childNodePathBuilder);
      } else {
        parentNode.linkChildViaProp(childNodePathBuilder);
      }
    }
  }

  addChild(childNode: MockTreeNode, childNodePathBuilder: PathBuilder) {
    const parentNode = this.getOrAddOrReplaceTemp(childNodePathBuilder.parentPathBuilder.path, new MockTreeNode());
    this.setNode(childNodePathBuilder.path, childNode);
    parentNode.linkChildViaProp(childNodePathBuilder);
  }

  deleteSubtree(path: string) {
    for (const key in this.tree) {
      if (key.length > path.length && (key.startsWith(path + '.') || key.startsWith(path + '('))) {
        // By construction: if node index starts with path. or path( then the node is in subtree of node with index = path.
        delete this.tree[key];
      }
    }
    delete this.tree[path];
  }

  forEachSubtreeNode(path: string, action: (node: MockTreeNode) => void) {
    for (const key in this.tree) {
      if (key.length > path.length && (key.startsWith(path + '.') || key.startsWith(path + '('))) {
        // By construction: if node index starts with path. or path( then the node is in subtree of node with index = path.
        action(this.tree[key])
      }
    }
    if (this.tree[path]) {
      action(this.tree[path]);
    }
  }

  // Convert tree to hierarchy of objects and functions based on node paths and node values.
  toObject(path: string, externalMock?: IExternalMock): Undefinable {
    const node = this.tree[path];
    if (node.hasValue()) {
      let value = node.getValue();
      if (node.isTemp()) {
        value = globalOptions.autoValuesPrefix + value;
      }
      return new Undefinable(value);
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

const userMockTrees: MockTree[] = [];
let sutMockTrees: MockTree[] = [];

// This function removes all tm proxies from data.
export function tunmock(_data) {
  const visitedObjects: any[] = [];
  return tunmockInternal(_data);

  function tunmockInternal(data) {
    if (!isInstanceofObject(data)) {
      return data;
    }
    if (isObjectOrClass(data)) {
      if (visitedObjects.includes(data)) {
        return data;
      }
      visitedObjects.push(data);
    }
    if (isMockProxy(data)) {
      return tunmockInternal(data[MOCK_PROXY_TO_OBJECT]);
    }
    if (isArray(data)) {
      return data.map((item) => tunmockInternal(item))
    }
    if (isSpy(data)) {
      const originalFunction = data[ORIGINAL_FUNCTION];
      shallowMergeFromTo(data, originalFunction, (val) => val, [IS_A_SPY, ORIGINAL_FUNCTION]);
      return originalFunction;
    }
    const result = isFunction(data) ? data : {};
    shallowMergeFromTo(data, result, (val) => tunmockInternal(val));
    return result;
  }
}

export function tinfo(data: any): MockInfo {
  return {
    externalMock: data[EXTERNAL_MOCK],
  };
}

export function treset(mock?: any) { // TODO: this function should not reset data setup by tmock/tset!
  if (mock) {
    mock(RESET_MOCK_PROXY);
    return;
  }
  sutMockTrees = [];
  totalCallLog = [];
}

export function tcalls(mock?: any): string[] {
  if (!mock) {
    return totalCallLog.map((call) => call.pathToBeShown);
  }
  const pathBuilder = mock[MOCK_PROXY_PATHBUILDER] as PathBuilder;
  return totalCallLog
    .filter((call) => call.groupId == pathBuilder.groupId && call.path.startsWith(pathBuilder.path))
    .map((call) => call.pathToBeShown);
}

function applyCouplesToStub(stubWrapper: StubWrapper, initCouples: InitCouple[]) {
  initCouples.forEach(initCouple => {
    const proxyContext: StubInitializationProxyContext = {
      stubRef: stubWrapper.stub,
      prevStubRef: stubWrapper.stub,
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
      throw new Error('Cannot replace stab root'); // TODO: why not? allow this?
    }
    if (proxyContext.stubReplacement) {
      stubWrapper.stub = proxyContext.stubReplacement;
    }
  });
}

export function tset<T = any>(stubWrapperOrMock, initCoupleOrCouples: [(mockProxy: T) => any, any] | ([(mockProxy: T) => any, any])[]) {
  const initCouples = (isInitCouple(initCoupleOrCouples) ? [initCoupleOrCouples] : initCoupleOrCouples) as InitCouple[];
  if (isMockProxy(stubWrapperOrMock)) {
    stubWrapperOrMock(SET_MOCK_PROXY_RETURN_VALUES, initCouples);
  } else {
    applyCouplesToStub(stubWrapperOrMock, initCouples);
  }
}

let globalOptions: TmockGlobalOptions = {
  automock: true,
  simplifiedOutput: true,
  defaultMockName: 'mock',
  quoteSymbol: '\'',
  exposeFunctionNames: false,
  autoValuesPrefix: '',
};

export function tglobalopt(options?: Partial<TmockGlobalOptions>): TmockGlobalOptions {
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

function getStubInitializationProxy(proxyContext: StubInitializationProxyContext) {
  const initializationProxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      proxyContext.pathBuilder = proxyContext.pathBuilder.withProp(prop);
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
      proxyContext.pathBuilder = proxyContext.pathBuilder.withCall(args);
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
      proxyContext.stubRef = getOrAddObjPropVal(stubRef, key);
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

type MockInitializationProxyContext = {
  tree: MockTree;
  pathBuilder: PathBuilder;
  stubProxyContext?: StubInitializationProxyContext;
}

function getMockInitializationProxy(proxyContext: MockInitializationProxyContext) {
  const proxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      proxyContext.pathBuilder = proxyContext.pathBuilder.withProp(prop);
      proxyContext.tree.addChildIfNotExistOrReplaceTemp(new MockTreeNode(), proxyContext.pathBuilder);
      return pickProxy();
    },
    apply(target, thisArg, args) {
      proxyContext.pathBuilder = proxyContext.pathBuilder.withCall(args);
      proxyContext.tree.addChildIfNotExistOrReplaceTemp(new MockTreeNode(), proxyContext.pathBuilder, new CallInfo(thisArg, args));
      return pickProxy();
    },
  });
  return proxy;

  function pickProxy() {
    const node = proxyContext.tree.getNode(proxyContext.pathBuilder.path);
    if (node.isFinal()) {
      const value = node.getValue();
      const stubProxyContext: StubInitializationProxyContext = {
        stubRef: value,
        prevStubRef: value,
        prevProp: '',
        stubReplacement: undefined,
        pathBuilder: new PathBuilder('', ''),
      };
      proxyContext.stubProxyContext = stubProxyContext;
      return getStubInitializationProxy(stubProxyContext);
    }
    return proxy;
  }
}

function applyCouplesToMock(initCouples: InitCouple[], pathBuilder: PathBuilder, options: TmockGlobalOptions) {
  const userMockTree = userMockTrees[pathBuilder.groupId];
  initCouples.forEach(initCouple => {
    const proxyContext: MockInitializationProxyContext = {
      tree: userMockTree,
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
      userMockTree.setNode(path, new TreeNodeFinal(val));
    } else {
      if (stubProxyContext.stubReplacement) {
        userMockTree.setNode(path, new TreeNodeFinal(stubProxyContext.stubReplacement));
      } else if (!stubProxyContext.prevProp) {
        userMockTree.setNode(path, new TreeNodeFinal(val));
      }
      if (stubProxyContext.prevProp) {
        stubProxyContext.prevStubRef[stubProxyContext.prevProp] = val;
      }
    }
  });
}

function getNodeToReturnValue(tree: MockTree, pathBuilder: PathBuilder, callInfo?: CallInfo) {
  const node = tree.getNode(pathBuilder.path);
  if (node?.isFinal()) {
    return node;
  }
  if (callInfo) {
    const pathBuilderAny = pathBuilder.parentPathBuilder.withCall([TM_ANY]);
    const node = tree.getNode(pathBuilderAny.path); // TODO: reuse code
    if (node?.isFinal()) {
      return node;
    }
  }
}
function traversePropOrCall(pathBuilder: PathBuilder, options: TmockGlobalOptions, callInfo?: CallInfo) {
  const sutMockTree: MockTree = sutMockTrees[pathBuilder.groupId];
  const sutNode = getNodeToReturnValue(sutMockTree, pathBuilder, callInfo);
  if (sutNode) {
    return sutNode.getValue();
  }
  const userMockTree = userMockTrees[pathBuilder.groupId];
  const userNode = getNodeToReturnValue(userMockTree, pathBuilder, callInfo);
  if (userNode) {
    return userNode.getValue();
  }

  if (!options.automock) {
    // Stop proxing if automock is false and propertry has not been explicitly mocked.
    return undefined;
  }

  sutMockTree.addChildIfNotExistOrReplaceTemp(new TreeNodeTemp(pathBuilder.pathToBeShown), pathBuilder, callInfo);
  if (callInfo) {
    totalCallLog.push(pathBuilder);
  }

  return getSutProxy(pathBuilder, options);
}

function getSutProxy(pathBuilder: PathBuilder, options: TmockGlobalOptions) {
  const userMockTree: MockTree = userMockTrees[pathBuilder.groupId];
  const sutMockTree: MockTree = sutMockTrees[pathBuilder.groupId];
  const path = pathBuilder.path;
  const sutProxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      // Handle special properties.
      switch (prop) {
        case IS_A_MOCK_PROXY: return true;
        case MOCK_PROXY_PATHBUILDER: return pathBuilder;
        case MOCK_PROXY_NAME: return options.defaultMockName;
        case MOCK_PROXY_TO_OBJECT:
          return MockTree
            .fromUserTreeAndSutTree(userMockTree, sutMockTree)
            .toObject(pathBuilder.path, options.externalMock)
            .getValue();
        case 'hasOwnProperty': return () => true;
        case Symbol.toPrimitive: return target as any; // Prevent from 'TypeError: Cannot convert object to primitive value'.
      }

      return traversePropOrCall(pathBuilder.withProp(prop), options);
    },

    set(target, prop, value) {
      sutMockTree.addChild(new TreeNodeFinal(value), pathBuilder.withProp(prop));
      return true;
    },

    apply(target, thisArg, args) {
      if (args.length > 0) {
        const firstArg = args[0];
        // Handle special arguments.
        if (firstArg === SET_MOCK_PROXY_RETURN_VALUES) {
          const initCoulpes = args[1];
          applyCouplesToMock(initCoulpes, pathBuilder, options);
          return sutProxy;
        } else if (firstArg === RESET_MOCK_PROXY) {
          if (sutMockTree.getNode(path)) {
            sutMockTree.deleteSubtree(path);
            sutMockTree.setNode(path, new TreeNodeTemp(pathBuilder.pathToBeShown));
            // Reset nested mocks.
            userMockTree.forEachSubtreeNode(path, (node) => {
              const nodeValue = node.getValue();
              if (isMockProxy(nodeValue)) {
                treset(nodeValue);
              }
            });
          }
          totalCallLog = totalCallLog
            .filter((call) => call.groupId !== pathBuilder.groupId || !call.path.startsWith(path));
          return undefined;
        }
      }

      return traversePropOrCall(pathBuilder.withCall(args), options, new CallInfo(thisArg, args));
    },
  });

  return sutProxy;
}

function parseTmockArgs(nameOrInitOrOptionsArg?: string | InitCouple | AnyInitializer[] | TmockOptions,
  initOrOptionsArg?: InitCouple | AnyInitializer[] | TmockOptions,
  optionsArg?: TmockOptions)
{
  let name: string | undefined;
  let initializers: AnyInitializer[] | undefined;
  let options: TmockOptions | undefined;
  const multipleOptionsArgsErrorMessage = 'tmock: multiple options arguments not allowed';
  if (nameOrInitOrOptionsArg) {
    if (isString(nameOrInitOrOptionsArg)) {
      name = nameOrInitOrOptionsArg as string;
    } else if (isArray(nameOrInitOrOptionsArg)) {
      initializers = getInitializers(nameOrInitOrOptionsArg);
    } else {
      options = nameOrInitOrOptionsArg as TmockOptions;
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
      options = initOrOptionsArg as TmockOptions;
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
  nameOrSetupOrOptionsArg?: string | InitObjectOrInitCouple<T>[] | TmockOptions,
  setupOrOptionsArg?: InitObjectOrInitCouple<T>[] | TmockOptions,
  optionsArg?: TmockOptions)
{
  const parsedArgs = parseTmockArgs(nameOrSetupOrOptionsArg, setupOrOptionsArg, optionsArg);

  const options: TmockFullOptions = {
    ...globalOptions,
    ...parsedArgs.options,
  };
  if (parsedArgs.name) {
    options.defaultMockName = parsedArgs.name;
  }

  const mockId = (totalMocksCounter++).toString();
  const pathBuilder = new PathBuilder(mockId, options.defaultMockName, options.simplifiedOutput);
  const userMockTree = new MockTree();
  userMockTree.setNode('', new TreeNodeTemp(options.defaultMockName));
  const sutMockTree = new MockTree();
  sutMockTree.setNode('', new TreeNodeTemp(options.defaultMockName));
  userMockTrees[mockId] = userMockTree;
  sutMockTrees[mockId] = sutMockTree;

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
  const stubFromInitializer = initializers.find(initializer => isObject(initializer));
  const stupWrapper: StubWrapper = {
    stub: deepClone(stubFromInitializer) || {},
  }

  if (initCouples) {
    tset(stupWrapper, initCouples);
  }

  return stupWrapper.stub;
}

export default {
  ANY: TM_ANY,
  mock: tmock,
  stub: tstub,
  set: tset,
  reset: treset,
  unmock: tunmock,
  info: tinfo,
  calls: tcalls,
  globalopt: tglobalopt,
};