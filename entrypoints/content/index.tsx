export default defineContentScript({
  registration: 'runtime',
  main() {
    console.info('[웹 메모] Content Script가 로드되었습니다.');
  },
});
