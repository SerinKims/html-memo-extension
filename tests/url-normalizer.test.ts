import { describe, expect, it } from 'vitest';

import { createPageKey, normalizeUrl } from '../utils/url-normalizer';

describe('normalizeUrl', () => {
  it('추적 파라미터와 fragment를 제거하고 나머지 query를 정렬한다', () => {
    expect(
      normalizeUrl(
        'HTTPS://Example.COM/products?utm_source=newsletter&id=42&fbclid=tracking&view=detail#reviews',
      ),
    ).toBe('https://example.com/products?id=42&view=detail');
  });

  it('페이지를 식별하는 파라미터와 중복 파라미터는 유지한다', () => {
    expect(normalizeUrl('https://example.com/search?page=2&q=memo&q=html&utm_medium=email')).toBe(
      'https://example.com/search?page=2&q=html&q=memo',
    );
  });

  it('추적 파라미터만 다른 URL에 같은 page key를 부여한다', () => {
    expect(createPageKey('https://example.com/docs?id=7&utm_campaign=summer')).toBe(
      createPageKey('https://example.com/docs?id=7&fbclid=abc'),
    );
  });

  it('웹페이지가 아닌 URL은 거부한다', () => {
    expect(() => normalizeUrl('data:text/html;base64,AAAA')).toThrow(
      'http, https 또는 file 웹페이지 URL만 사용할 수 있습니다.',
    );
  });

  it('로컬 파일 URL의 query와 fragment를 제거하고 파일 경로는 유지한다', () => {
    expect(
      normalizeUrl('file:///C:/Users/%EC%97%B0%EA%B5%AC%EC%9B%90/My%20Report.html?draft=1#note'),
    ).toBe('file:///C:/Users/%EC%97%B0%EA%B5%AC%EC%9B%90/My%20Report.html');
  });

  it('서로 다른 로컬 경로에는 다른 page key를 부여한다', () => {
    expect(createPageKey('file:///C:/research/a/report.html')).not.toBe(
      createPageKey('file:///C:/research/b/report.html'),
    );
  });
});
