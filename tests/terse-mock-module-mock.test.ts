import { tmock, tunmock } from '../src/terse-mock';
jest.mock('./module-mocked', () => tmock('module-mocked', [{
  function2: () => '777',
}]));
import { f } from './module-uses-mocked'

test('should work as jest.mock argument that setup predefined return values', () => {
  // ACT
  const res = tunmock(f());

  // ASSERT
  expect(res).toEqual({
    a: 'module-mocked.function1()',
    b: '777',
    c: 'module-mocked.function1()777',
  });
});