// TODO: split into files
const PATHBUILDER = Symbol('PATHBUILDER');
const MOCK_PROXY_TO_OBJECT = Symbol('MOCK_PROXY_TO_OBJECT');
const RESET_MOCK_PROXY = Symbol('RESET_MOCK_PROXY');
const SET_MOCK_PROXY_RETURN_VALUES = Symbol('SET_MOCK_PROXY_RETURN_VALUES');
const EXTERNAL_MOCK = Symbol('EXTERNAL_MOCK');
const ARGS_TO_RETURN_VALUES = Symbol('ARGS_TO_RETURN_VALUES');
const IS_A_MOCK_PROXY = Symbol('IS_A_MOCK_PROXY');
const IS_A_SPY = Symbol('IS_A_SPY');
const IS_A_STUB = Symbol('IS_A_STUB');
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
//    if (simplify) { // Stringified functions are always simplified now
  const found = String(data).match(/(\S*)\s*\(/);
  if (!found || found[1] === 'function') {
    return '<function>';
  }
  const name = found[1];
  let text = '<arrow function>';
  if (name) {
    if (globalOptions.exposeFunctionNames) {
      text = '<function ' + name + '>';
    } else {
      text = '<function>';
    }
  }
  return text;
//    }
//    return String(data);
}

function collapseIfNeeded(data: string, collapsedData: string, options?: TOpt) {
  if (!options) {
    return data;
  }
  if (options.collapseLongValues && data.length > options.collapseThreshold) {
    return collapsedData;
  }
  return data;
}

function toString(data: any, options?: TOpt) {
  if (isArray(data)) {
    const dataStr = '[' + data.map((item) => toString(item, options)).join(', ') + ']';
    return collapseIfNeeded(dataStr, '[...]', options);
  }
  if (isObject(data)) {
    const props = Object.keys(data);
    const dataStr = '{' + props.map((key) => key + ': ' + toString(data[key])).join(', ') + '}';
    return collapseIfNeeded(dataStr, '{...}', options);
  }
  if (isFunction(data)) {
    if (isMockProxy(data)) {
      const pathBuilder = data[PATHBUILDER] as PathBuilder;
      return collapseIfNeeded(pathBuilder.pathToBeShown, '<...>', options);
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

function isStub(data: any) {
  return data && data[IS_A_STUB] === true;
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

function argsToString(args: any[], options?: TOpt) {
  return '(' + args.map((arg) => toString(arg, options)).join(', ') + ')';
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
        // otherwise we may end up with problems like incorrect results of jest matchers.
        return createSpy(pathBuilder, source, externalMock);
      }
      const result = createSpy(pathBuilder, source.bind(thisArg), externalMock); // TODO: test this binding
      shallowMergeFromTo(source, result, (val) => deepCloneAndSpyifyInternal(val, pathBuilder, externalMock, source));
      return result;
    }

    return source;
  }
}

function shallowMergeFromTo(from: Object, to: Object, mapper: PropMapperType = (val) => val, except: (string|symbol)[] = []) {
  for (const prop in from) {
    copyPropOrSymbol(prop);
  }
  for (const symbol of Object.getOwnPropertySymbols(from) ) {
    copyPropOrSymbol(symbol);
  }
  return to;

  function copyPropOrSymbol(propOrSymbol: string|symbol) {
    if (!except.includes(propOrSymbol)) {
      const descriptor = Object.getOwnPropertyDescriptor(from, propOrSymbol)!;
      if (descriptor.value) {
        descriptor.value = mapper(descriptor.value, propOrSymbol);
      }
      Object.defineProperty(to, propOrSymbol, descriptor);
    }
  }
}

const defaultProxyTarget = new Function();

export interface IExternalMock {
  create: () => any;
}

function createMockFunction(thisArg: any, defaultReturnSetter: (context: MockFunctionContext) => any = () => undefined) {
  const context: MockFunctionContext = {
    argsToReturnValues: {},
  };

  const mockFunction = function (...args: any[]) {
    const keyFromArgs = argsToString(args);
    return context.argsToReturnValues.hasOwnProperty(keyFromArgs) ? context.argsToReturnValues[keyFromArgs] : defaultReturnSetter(context);
  };

  mockFunction[IS_A_MOCKED_FUNCTION] = true;
  mockFunction[ARGS_TO_RETURN_VALUES] = context.argsToReturnValues;
  return mockFunction;
}

function createSpy(pathBuilder: PathBuilder, originalFunction: any, externalMock?: IExternalMock) {
  const spy = function () {
    const args = [...arguments];
    const unmockedArgs = tunmock(args);
    totalCallLog.push(new CallInfo(null, args, pathBuilder.withCall(args)));
    if (externalMock) {
      spy[EXTERNAL_MOCK](...unmockedArgs);
    }
    return originalFunction(...unmockedArgs);
  };
  shallowMergeFromTo(originalFunction, spy);
  if (externalMock) {
    spy[EXTERNAL_MOCK] = externalMock.create();
  }
  spy[PATHBUILDER] = pathBuilder;
  spy[IS_A_SPY] = true;
  spy[ORIGINAL_FUNCTION] = originalFunction;
  return spy;
}

type MockFunctionContext = {
  //argsToReturnValues: Map<string, any>;
  argsToReturnValues: { [key: string]: any };
}

export type TOpt = {
  automock: boolean;
  collapseLongValues: boolean;
  collapseThreshold: number;
  externalMock?: IExternalMock;
  exposeFunctionNames: boolean;
  autoValuesPrefix: string;
  defaultMockName: string;
  quoteSymbol: string;
}

export type MockInfo = {
  externalMock: any;
  calls: any[];
  callLog: string[];
}

// TODO: implement mock times.

class CallInfo {
  private this_: any;
  private args_: any[];
  private pathBuilder_: PathBuilder;

  constructor(thisArg: any, args: any[], pathBuilder: PathBuilder) {
    this.this_ = thisArg;
    this.args_ = args;
    this.pathBuilder_ = pathBuilder;
  }

  public get this() {
    return this.this_;
  }
  public get args() {
    return this.args_;
  }
  public get pathBuilder() {
    return this.pathBuilder_;
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
  private options_?: TOpt;

  constructor(groupId: string, pathToBeShown: string, options?: TOpt) {
    this.groupId_ = groupId;
    this.path_ = '';
    this.pathToBeShown_ = pathToBeShown;
    this.options_ = options;
  }

  public withCall(args: any[]): PathBuilder {
    const latestPathChunk = argsToString(args);

    const pathToBeShownChunk = !this.options_?.collapseLongValues ? latestPathChunk : argsToString(args, this.options_);
    const newPathBuilder = new PathBuilder(
      this.groupId_,
      this.pathToBeShown_ + pathToBeShownChunk,
      this.options_);
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
      this.options_);
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
  protected pathBuilder_: PathBuilder;

  constructor(pathBuilder: PathBuilder) {
    this.pathBuilder_ = pathBuilder;
  }

  static fromUserNodeAndSutNode(userNode: MockTreeNode, sutNode: MockTreeNode): MockTreeNode {
    if (sutNode.isFinal()) {
      return sutNode;
    }
    if (userNode.isFinal()) {
      return userNode;
    }
    const node = new MockTreeNode(userNode.pathBuilder_);
    node.propsToChildPaths_ = { ...userNode.propsToChildPaths_, ...sutNode.propsToChildPaths_ };
    node.argsToChildPaths_ = { ...userNode.argsToChildPaths_, ...sutNode.argsToChildPaths_ };
    node.calls_ = [ ...userNode.calls_, ...sutNode.calls_ ];
    if (userNode.isTemp_ && sutNode.isTemp_) {
      node.value_ = sutNode.value_;
      node.isTemp_ = true;
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

  hasCalls() {
    return this.calls_.length > 0;
  }

  applyCallsToFuntion(f: Function) {
    this.calls_.forEach((callInfo) =>
      f.apply(callInfo.this, tunmock(callInfo.args)));
  }

  hasValue() {
    return this.value_.hasValue();
  }

  getValue() {
    return this.value_.getValue();
  }

  toMockFunction() {
    return createMockFunction({});
  }

  isFinal() {
    return this.isFinal_;
  }

  isTemp() {
    return this.isTemp_;
  }
}

class TreeNodeTemp extends MockTreeNode {
  constructor(pathBuilder: PathBuilder) {
    super(pathBuilder);
    this.isTemp_ = true;
    this.value_.setValue(pathBuilder.pathToBeShown);
  }
}

class TreeNodeFinal extends MockTreeNode {
  constructor(pathBuilder: PathBuilder, value: any) {
    super(pathBuilder);
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
    const parentNode = this.getOrAddOrReplaceTemp(childNodePathBuilder.parentPathBuilder.path, new MockTreeNode(childNodePathBuilder.parentPathBuilder));

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
    const parentNode = this.getOrAddOrReplaceTemp(childNodePathBuilder.parentPathBuilder.path, new MockTreeNode(childNodePathBuilder.parentPathBuilder));
    this.setNode(childNodePathBuilder.path, childNode);
    parentNode.linkChildViaProp(childNodePathBuilder);
  }

  deleteSubtree(path?: string) {
    if (!path) {
      this.tree = {};
      return;
    }
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
  toObject(path: string, options: TOpt): Undefinable {
    const node = this.tree[path];
    if (node.hasValue()) {
      let value = node.getValue();
      if (node.isTemp()) {
        value = options.autoValuesPrefix + (value || '<mock>');
      }
      return new Undefinable(value);
    }

    const collectValuesFromChildren = (res: Object, propsOrArgsToChildPaths: StringDictionary) =>
      shallowMergeFromTo(propsOrArgsToChildPaths, res, (val) => this.toObject(val, options).getValue());

    let result = {};
    if (node.hasCalls()) { // node represents something collable.
      result = node.toMockFunction();
      collectValuesFromChildren(result[ARGS_TO_RETURN_VALUES], node.getArgsToChildPaths());
    }
    collectValuesFromChildren(result, node.getPropsToChildPaths());

    return new Undefinable(result);
  }
}

let totalCallLog: CallInfo[] = [];

let totalMocksCounter = 0;

const userMockTrees: { [index: string]: MockTree } = {};
const sutMockTrees: { [index: string]: MockTree } = {};

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

// TODO: make tinfo accept two arguments like (mock, m => m.p.f5) so you dont't have to pass single (mock.p.f5) and mutate mock.
export function tinfo(mockOrSpy?: any): MockInfo {
  if (!mockOrSpy) {
    return {
      externalMock: undefined,
      calls: totalCallLog.map((call) => tunmock(call.args)),
      callLog: totalCallLog.map((call) => call.pathBuilder.pathToBeShown),
    }
  }
  if (!isMockProxy(mockOrSpy) && !isSpy(mockOrSpy)) {
    throw new Error('tinfo: argument should be either mock or spy');
  }
  const pathBuilder = mockOrSpy[PATHBUILDER];
  return {
    externalMock: mockOrSpy[EXTERNAL_MOCK],
    calls: fillterByPath().map((call) => tunmock(call.args)),
    callLog: fillterByPath().map((call) => call.pathBuilder.pathToBeShown),
  };

  function fillterByPath() {
    return totalCallLog.filter((call) => call.pathBuilder.groupId === pathBuilder.groupId && call.pathBuilder.path.startsWith(pathBuilder.path));
  }
}

export function treset(mock?: any) {
  if (mock) {
    mock(RESET_MOCK_PROXY);
    return;
  }
  Object.values(sutMockTrees).forEach((mockTree) => mockTree.deleteSubtree());
  totalCallLog = [];
  localOptions = {};
}

function applyCouplesToStub(stub, initCouples: TInitCouple[]) {
  let returnValue = stub;

  initCouples.forEach(initCouple => {
    const proxyContext: StubInitializationProxyContext = {
      stubRef: returnValue,
      prevStubRef: returnValue,
      prevProp: '',
      stubReplacement: undefined,
      pathBuilder: new PathBuilder('', ''),
    };

    const initializationProxy = getStubInitializationProxy(proxyContext);

    // Traverse initialization expression.
    initCouple[0](initializationProxy);

    if (proxyContext.prevProp) {
      proxyContext.prevStubRef[proxyContext.prevProp] = initCouple[1];
    } else {
      returnValue = initCouple[1];
    }
    if (proxyContext.stubReplacement) {
      returnValue = proxyContext.stubReplacement;
    }
  });

  return returnValue;
}

export function tset<T = any>(stubWrapperOrMock, initCoupleOrCouples: [(mockProxy: T) => any, any] | ([(mockProxy: T) => any, any])[]) {
  const initCouples = (isInitCouple(initCoupleOrCouples) ? [initCoupleOrCouples] : initCoupleOrCouples) as TInitCouple[];
  if (isMockProxy(stubWrapperOrMock)) {
    stubWrapperOrMock(SET_MOCK_PROXY_RETURN_VALUES, initCouples);
  } else if (isStub(stubWrapperOrMock)) {
    const newStub = applyCouplesToStub(stubWrapperOrMock, initCouples);
    if (newStub != stubWrapperOrMock) {
      throw new Error('tset: cannot replace stub root');
    }
  } else {
    throw new Error('tset: first argument should be either mock or stub');
  }
}

let globalOptions: TOpt = {
  automock: true,
  collapseLongValues: true, // Should this be done by default?
  collapseThreshold: 40,
  defaultMockName: '<mock>',
  quoteSymbol: '\'',
  exposeFunctionNames: false,
  autoValuesPrefix: '',
};

let localOptions: Partial<TOpt> = {};

export function tglobalopt(options?: Partial<TOpt>): TOpt {
  if (options) {
    globalOptions = {...globalOptions, ...deepClone(options)};
  }
  return globalOptions;
}

export function tlocalopt(options?: Partial<TOpt>): Partial<TOpt> {
  if (options) {
    localOptions = {...localOptions, ...deepClone(options)};
  }
  return localOptions;
}

export type TInitCouple<T = void> = T extends void ? [(mockProxy: any) => any, any] : [(mockProxy: T) => any, any];
export type TInitObject<T = void> = T extends void ? { [x:string]: Object | undefined | null } : Partial<T>;
export type TInit<T = void> = TInitObject<T> | TInitCouple<T> | (TInitObject<T> | TInitCouple<T>)[];

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
        const stubFunc = createMockFunction(thisArg, (context) => context.argsToReturnValues[ANY_ARGS]);
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
      proxyContext.tree.addChildIfNotExistOrReplaceTemp(new MockTreeNode(proxyContext.pathBuilder), proxyContext.pathBuilder);
      return pickProxy();
    },
    apply(target, thisArg, args) {
      proxyContext.pathBuilder = proxyContext.pathBuilder.withCall(args);
      proxyContext.tree.addChildIfNotExistOrReplaceTemp(new MockTreeNode(proxyContext.pathBuilder), proxyContext.pathBuilder,
        new CallInfo(thisArg, args, proxyContext.pathBuilder));
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

function applyCouplesToMock(initCouples: TInitCouple[], pathBuilder: PathBuilder, options: TOpt) {
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
      userMockTree.setNode(path, new TreeNodeFinal(proxyContext.pathBuilder, val));
    } else {
      if (stubProxyContext.stubReplacement) {
        userMockTree.setNode(path, new TreeNodeFinal(proxyContext.pathBuilder, stubProxyContext.stubReplacement));
      } else if (!stubProxyContext.prevProp) {
        userMockTree.setNode(path, new TreeNodeFinal(proxyContext.pathBuilder, val));
      }
      if (stubProxyContext.prevProp) {
        stubProxyContext.prevStubRef[stubProxyContext.prevProp] = val;
      }
    }
  });
}

function getFinalNode(tree: MockTree, pathBuilder: PathBuilder, callInfo?: CallInfo) {
  const node = tree.getNode(pathBuilder.path);
  if (node?.isFinal()) {
    return node;
  }
  if (callInfo) {
    const pathBuilderAny = pathBuilder.parentPathBuilder.withCall([TM_ANY]);
    const node = tree.getNode(pathBuilderAny.path);
    if (node?.isFinal()) {
      return node;
    }
  }
}

function traversePropOrCall(pathBuilder: PathBuilder, options: TOpt, callInfo?: CallInfo) {
  if (callInfo) {
    totalCallLog.push(callInfo);
  }

  const sutMockTree: MockTree = sutMockTrees[pathBuilder.groupId];
  const nodeSetInSut = getFinalNode(sutMockTree, pathBuilder, callInfo);
  if (nodeSetInSut) {
    return nodeSetInSut.getValue();
  }

  const userMockTree = userMockTrees[pathBuilder.groupId];
  const nodeSetByUser = getFinalNode(userMockTree, pathBuilder, callInfo);
  if (nodeSetByUser) {
    return nodeSetByUser.getValue();
  }

  if (!options.automock) {
    // Stop proxing if automock is false and propertry has not been explicitly mocked.
    return undefined;
  }

  sutMockTree.addChildIfNotExistOrReplaceTemp(new TreeNodeTemp(pathBuilder), pathBuilder, callInfo);

  return getSutProxy(pathBuilder, options);
}

function getSutProxy(pathBuilder: PathBuilder, options: TOpt) {
  const userMockTree: MockTree = userMockTrees[pathBuilder.groupId];
  const sutMockTree: MockTree = sutMockTrees[pathBuilder.groupId];
  const path = pathBuilder.path;
  const sutProxy = new Proxy(defaultProxyTarget, {
    get(target, prop) {
      // Handle special properties.
      switch (prop) {
        case IS_A_MOCK_PROXY: return true;
        case PATHBUILDER: return pathBuilder;
        case MOCK_PROXY_TO_OBJECT:
          return MockTree
            .fromUserTreeAndSutTree(userMockTree, sutMockTree)
            .toObject(pathBuilder.path, options)
            .getValue();
        case 'hasOwnProperty': return () => true;
        case EXTERNAL_MOCK:
          if (!options.externalMock) {
            return undefined;
          }
          const node = sutMockTree.getNode(path)!;
          const externalMock = options.externalMock.create();
          node.applyCallsToFuntion(externalMock);
          return externalMock;
        case Symbol.toPrimitive: return () => pathBuilder.pathToBeShown; // Prevent from 'TypeError: Cannot convert object to primitive value'.
      }

      return traversePropOrCall(pathBuilder.withProp(prop), options);
    },

    set(target, prop, value) {
      const newPathBuilder = pathBuilder.withProp(prop);
      sutMockTree.addChild(new TreeNodeFinal(newPathBuilder, value), newPathBuilder);
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
            sutMockTree.setNode(path, new TreeNodeTemp(pathBuilder));
            // Reset nested mocks.
            userMockTree.forEachSubtreeNode(path, (node) => {
              const nodeValue = node.getValue();
              if (isMockProxy(nodeValue)) {
                treset(nodeValue);
              }
            });
          }
          totalCallLog = totalCallLog
            .filter((call) => call.pathBuilder.groupId !== pathBuilder.groupId || !call.pathBuilder.path.startsWith(path));
          return undefined;
        }
      }

      const pathBuilderWithCall = pathBuilder.withCall(args);
      return traversePropOrCall(pathBuilderWithCall, options, new CallInfo(thisArg, args, pathBuilderWithCall));
    },
  });

  return sutProxy;
}

function parseTmockArgs<T>(nameOrInitializersArg?: NameOrInitializerArgType<T>, initializersArg?: InitializerArgType<T>) {
  let name: string | undefined;
  let initializers: (TInitCouple | TInitObject)[] | undefined;
  if (nameOrInitializersArg !== undefined) {
    if (isString(nameOrInitializersArg)) {
      name = nameOrInitializersArg as string;
    } else {
      initializers = unifyInitializers(nameOrInitializersArg);
    }
  }
  if (initializersArg) {
    if (initializers) {
      throw new Error('tmock: multiple initializer arguments not allowed');
    }
    initializers = unifyInitializers(initializersArg);
  }
  return { name, initializers };

  // TODO: reuse
  // TODO: add trasformation InitObject -> InitCouples ?
  function unifyInitializers(arg): (TInitCouple | TInitObject)[] {
    return (isInitCouple(arg) || isObject(arg) ? [arg] : arg);
  }
}

// Inspired by https://stackoverflow.com/questions/67824800/typescript-generic-use-default-value-only
type TypeOrVoid<T> = T extends void ? void : T;
type InitializerArgType<T> = TInit<TypeOrVoid<T>>;
type NameOrInitializerArgType<T> = string | InitializerArgType<T>;

export function tmock<T = void>(
  nameOrInitializerArg?: NameOrInitializerArgType<T>,
  initializerArg?: InitializerArgType<T>): T extends void ? any : T
{

  const parsedArgs = parseTmockArgs<T>(nameOrInitializerArg, initializerArg);

  const options: TOpt = {
    ...globalOptions,
    ...localOptions,
  };
  if (parsedArgs.name !== undefined) {
    options.defaultMockName = parsedArgs.name;
  }

  const mockId = (totalMocksCounter++).toString();
  const pathBuilder = new PathBuilder(mockId, options.defaultMockName, options);
  const userMockTree = new MockTree();
  userMockTree.setNode('', new TreeNodeTemp(pathBuilder));
  const sutMockTree = new MockTree();
  sutMockTree.setNode('', new TreeNodeTemp(pathBuilder));
  userMockTrees[mockId] = userMockTree;
  sutMockTrees[mockId] = sutMockTree;

  const initCouples: TInitCouple[] =
    parsedArgs.initializers?.filter(initializer => isArray(initializer) && (initializer as Array<any>).length === 2) as TInitCouple[] ?? [];

  const initObject = parsedArgs.initializers?.find(initializer => isObject(initializer)) ?? {};
  // Make init couples from init object.
  // TODO: apply in unifyInitializers
  for (const [prop, val] of Object.entries(initObject)) {
    initCouples.unshift([(p) => p[prop], val]);
  }

  const sutMockProxy = getSutProxy(pathBuilder, options);

  if (initCouples.length) {
    tset(sutMockProxy, initCouples);
  }

  return sutMockProxy;
}

// TODO: reuse unifyInitializers
export function tstub<T = void>(initializer: InitializerArgType<T>): T extends void ? any : T {
  let initializers: (TInitObject | TInitCouple)[];
  if (!isArray(initializer)) {
    initializers = [initializer as TInitObject];
  } else if (isInitCouple(initializer)) {
    initializers = [initializer as TInitCouple];
  } else {
    initializers = initializer as (TInitObject | TInitCouple)[];
  }

  const stubFromInitializer = initializers.find(initializer => isObject(initializer));
  let stub = deepClone(stubFromInitializer) ?? {};

  const initCouples: TInitCouple[] = initializers.filter(initializer => isInitCouple(initializer)) as TInitCouple[];
  stub = applyCouplesToStub(stub, initCouples);

  // TODO: is isFunction(stub) possible ?
  if (isObjectOrArrayOrClass(stub) || isFunction(stub)) {
    Object.defineProperty(stub, IS_A_STUB, { // Make stubs identifiable by setting non-enumerable property that is not exposed to user.
      value: true,
    });
  }

  return stub;
}

export default {
  ANY: TM_ANY,
  mock: tmock,
  stub: tstub,
  set: tset,
  reset: treset,
  unmock: tunmock,
  info: tinfo,
  globalopt: tglobalopt,
  localopt: tlocalopt,
};