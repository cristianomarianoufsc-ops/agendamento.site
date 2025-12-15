import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import EnsaioPage from './EnsaioPage';

// Mocking fetch to prevent API calls during test
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ allowBookingOverlap: false, stageTimes: { ensaio: { start: "08:00", end: "21:00" } }, blockedDates: [] }),
  })
);

// Mocking child components to simplify rendering
vi.mock('./components/Calendar', () => ({ default: ({ onDateSelect }) => <button data-testid="calendar" onClick={() => onDateSelect(new Date('2026-01-10T00:00:00.000Z'))}>Calendar</button> }));
vi.mock('./components/TimeBlockSelector', () => ({ default: ({ onTimeSelect }) => <button data-testid="time-selector" onClick={() => onTimeSelect('10:00')}>TimeSelector</button> }));
vi.mock('./components/Modal', () => ({ default: ({ children }) => <div>{children}</div> }));

// Mocking the internal implementation of useState to spy on setResumo and setStageTimes
const mockSetResumo = vi.fn();
const mockSetStageTimes = vi.fn();

vi.spyOn(React, 'useState')
  .mockImplementationOnce(initialState => [initialState, vi.fn()]) // localSelecionado
  .mockImplementationOnce(initialState => [initialState, vi.fn()]) // selectedStage
  .mockImplementationOnce(initialState => [new Date('2026-01-10T00:00:00.000Z'), vi.fn()]) // selectedDate
  .mockImplementationOnce(initialState => [initialState, vi.fn()]) // currentMonth
  .mockImplementationOnce(initialState => [{ startTime: '10:00', endTime: '12:00' }, mockSetStageTimes]) // stageTimes
  .mockImplementationOnce(initialState => [{ ensaio: [] }, mockSetResumo]) // resumo
  .mockImplementationOnce(initialState => ['calendar', vi.fn()]) // currentStep
  .mockImplementation(initialState => [initialState, vi.fn()]); // Other states

describe('EnsaioPage Multi-Select Logic', () => {
  it('should add a new ensaio to the resumo array and reset stageTimes when confirmStage is called', async () => {
    // Renderiza o componente
    render(<EnsaioPage />);

    // Simula a seleção do local para avançar para a etapa de calendário
    // É necessário mockar o estado `localSelecionado` para que o componente renderize a etapa 'calendar'
    // Como o mock de useState é limitado, vamos simular a seleção de data e tempo para que o botão de confirmação apareça
    // O botão 'Adicionar Ensaio ao Resumo' só aparece se selectedDate, startTime e endTime estiverem preenchidos.
    // O mock de useState já garante que selectedDate e stageTimes estejam preenchidos.
    // O mock de useState já garante que selectedDate, stageTimes e currentStep estejam preenchidos para a etapa 'calendar'.
    
    // O botão de confirmação é renderizado na tela
    const confirmButton = screen.getByText('Adicionar Ensaio ao Resumo');
    
    // Simula o clique no botão de confirmação
    fireEvent.click(confirmButton);

    // Espera que as funções de atualização de estado sejam chamadas
    await waitFor(() => {
      // 1. Verifica se setResumo foi chamado para adicionar o novo item ao array
      expect(mockSetResumo).toHaveBeenCalledWith(expect.any(Function));
      
      // Verifica a lógica de atualização do setResumo (a função passada para setResumo)
      const updateFunction = mockSetResumo.mock.calls[0][0];
      const newResumo = updateFunction({ ensaio: [{ date: '2026-01-09T00:00:00.000Z', start: '09:00', end: '11:00' }] });
      
      expect(newResumo.ensaio).toHaveLength(2);
      expect(newResumo.ensaio[1].start).toBe('10:00');
      expect(newResumo.ensaio[1].end).toBe('12:00');

      // 2. Verifica se setStageTimes foi chamado para resetar o tempo
      expect(mockSetStageTimes).toHaveBeenCalledWith({ startTime: null, endTime: null });
    });
  });
});
