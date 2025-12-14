// src/utils/stringUtils.test.js
import { describe, it, expect } from 'vitest';
import { capitalize } from './stringUtils';

describe('capitalize', () => {
  it('deve capitalizar a primeira letra de uma string', () => {
    expect(capitalize('teste')).toBe('Teste');
    expect(capitalize('hello world')).toBe('Hello world');
  });

  it('deve retornar uma string vazia para entrada nula', () => {
    expect(capitalize(null)).toBe('');
  });

  it('deve retornar uma string vazia para entrada indefinida', () => {
    expect(capitalize(undefined)).toBe('');
  });

  it('deve retornar uma string vazia para uma string vazia', () => {
    expect(capitalize('')).toBe('');
  });

  it('deve retornar a própria string se o primeiro caractere já for maiúsculo', () => {
    expect(capitalize('Teste')).toBe('Teste');
  });

  it('deve lidar com strings que não são strings (retornar vazio)', () => {
    expect(capitalize(123)).toBe('');
    expect(capitalize({})).toBe('');
    expect(capitalize([])).toBe('');
  });
});
