
import { describe, expect, it } from 'vitest';
import { assessSafety } from './safety';

describe('assessSafety', () => {
  it('detects possible urgent chest pain in Arabic', () => {
    expect(assessSafety('عندي وجع بالصدر هلّق').action).toBe('urgent');
  });

  it('detects possible urgent chest pain in English', () => {
    expect(assessSafety('I have chest pain right now').action).toBe('urgent');
  });

  it('detects possible urgent chest pain in French', () => {
    expect(assessSafety("J’ai une douleur à la poitrine").action).toBe('urgent');
  });

  it('continues for an ordinary appointment request', () => {
    expect(assessSafety('I want to book a dermatologist').action).toBe('continue');
  });

  it('asks for clarification when the message is empty', () => {
    expect(assessSafety('').action).toBe('clarify');
  });

  it('asks questions about ordinary stomach pain', () => {
    expect(assessSafety('My stomach hurts').action).toBe('clarify');
  });

  it('asks for clarification about past chest pain', () => {
    expect(
      assessSafety('I had chest pain last week, but I feel fine now').action
    ).toBe('clarify');
  });
});
