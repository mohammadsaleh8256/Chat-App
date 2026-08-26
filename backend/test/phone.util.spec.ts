import { PhoneUtil } from '../src/common/utils/phone.util';

describe('PhoneUtil', () => {
  it('normalizes 09162744975', () => {
    expect(PhoneUtil.normalize('09162744975')).toBe('+989162744975');
  });
  it('normalizes +989162744975', () => {
    expect(PhoneUtil.normalize('+989162744975')).toBe('+989162744975');
  });
  it('normalizes 00989162744975', () => {
    expect(PhoneUtil.normalize('00989162744975')).toBe('+989162744975');
  });
  it('normalizes 989162744975', () => {
    expect(PhoneUtil.normalize('989162744975')).toBe('+989162744975');
  });
  it('normalizes 9162744975', () => {
    expect(PhoneUtil.normalize('9162744975')).toBe('+989162744975');
  });
  it('throws on invalid', () => {
    expect(() => PhoneUtil.normalize('123')).toThrow();
    expect(() => PhoneUtil.normalize('')).toThrow();
  });
  it('tryNormalize returns null on invalid', () => {
    expect(PhoneUtil.tryNormalize('invalid')).toBeNull();
    expect(PhoneUtil.tryNormalize('09162744975')).toBe('+989162744975');
  });
  it('toDisplay converts back to local format', () => {
    expect(PhoneUtil.toDisplay('+989162744975')).toBe('09162744975');
    expect(PhoneUtil.toDisplay('')).toBe('');
  });
});
