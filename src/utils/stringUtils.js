// src/utils/stringUtils.js

/**
 * Capitaliza a primeira letra de uma string.
 * Retorna uma string vazia se a entrada for nula, indefinida, não for uma string, ou for uma string vazia.
 * @param {string} s - A string a ser capitalizada.
 * @returns {string} A string capitalizada ou uma string vazia.
 */
export const capitalize = (s) => {
  if (!s || typeof s !== 'string' || s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};
