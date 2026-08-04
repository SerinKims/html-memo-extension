import { EXPORT_DATA_ELEMENT_ID, EXPORT_MARKER_NAME, type ExportDocumentV2 } from '../types/export';
import { migrateExportDocument, serializeExportData } from './export-document';

const REVIEW_STYLES = String.raw`
:root{color-scheme:light;font-family:Inter,Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f4f6fa}
*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer}
.app{min-height:100vh}.topbar{position:sticky;top:0;z-index:20;display:flex;gap:16px;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-bottom:1px solid #dbe1ea;box-shadow:0 2px 8px #18243b12}
.title{min-width:0}.title h1{margin:0;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{margin-top:3px;font-size:12px;color:#64748b}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.toolbar button,.form-actions button{border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;background:#fff;color:#26344d;font-weight:650}.toolbar button[aria-pressed="true"],.primary{border-color:#2563eb!important;background:#2563eb!important;color:#fff!important}.save{background:#0f766e!important;border-color:#0f766e!important;color:#fff!important}
.status{padding:8px 20px;background:#eff6ff;color:#1e40af;font-size:13px}.status[data-dirty="true"]{background:#fff7ed;color:#9a3412}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;padding:18px}.canvas-shell{min-width:0;overflow:auto;border:1px solid #dbe1ea;border-radius:12px;background:#cbd5e1;padding:12px}.canvas{position:relative;margin:0 auto;width:min(100%,var(--capture-width));line-height:0;background:#fff}.canvas img{display:block;width:100%;height:auto}.note-layer{position:absolute;inset:0;pointer-events:none}.marker,.area{position:absolute;pointer-events:auto}.marker{width:28px;height:28px;transform:translate(-50%,-50%);border:2px solid #fff;border-radius:999px;background:#eab308;color:#172033;font-size:12px;font-weight:800;box-shadow:0 2px 8px #0005}.area{border:3px solid #eab308;background:#eab30826}.marker[data-color="red"],.area[data-color="red"]{--note-color:#ef4444}.marker[data-color="green"],.area[data-color="green"]{--note-color:#22c55e}.marker[data-color="blue"],.area[data-color="blue"]{--note-color:#3b82f6}.marker[data-color="purple"],.area[data-color="purple"]{--note-color:#a855f7}.marker:not([data-color="yellow"]),.area:not([data-color="yellow"]){background:var(--note-color);border-color:#fff}.area:not([data-color="yellow"]){background:color-mix(in srgb,var(--note-color) 16%,transparent);border-color:var(--note-color)}
.side{display:flex;flex-direction:column;gap:12px}.panel{border:1px solid #dbe1ea;border-radius:12px;background:#fff;padding:14px}.panel h2{margin:0 0 10px;font-size:15px}.note-list{display:flex;flex-direction:column;gap:8px;max-height:58vh;overflow:auto}.note-item{width:100%;text-align:left;border:1px solid #e2e8f0;border-left:5px solid #eab308;border-radius:8px;background:#fff;padding:9px}.note-item[data-status="resolved"]{opacity:.58}.note-item[data-color="red"]{border-left-color:#ef4444}.note-item[data-color="green"]{border-left-color:#22c55e}.note-item[data-color="blue"]{border-left-color:#3b82f6}.note-item[data-color="purple"]{border-left-color:#a855f7}.note-kind{display:flex;justify-content:space-between;font-size:11px;color:#64748b}.note-content{margin-top:5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.empty{color:#64748b;font-size:13px;line-height:1.5}
.editor[hidden]{display:none}.editor label{display:block;margin-top:10px;font-size:12px;font-weight:700}.editor input,.editor textarea,.editor select{width:100%;margin-top:5px;border:1px solid #cbd5e1;border-radius:7px;padding:8px;background:#fff}.editor textarea{min-height:100px;resize:vertical}.resolved-row{display:flex!important;align-items:center;gap:8px}.resolved-row input{width:auto;margin:0}.form-actions{display:flex;gap:7px;margin-top:12px}.form-actions .spacer{flex:1}.danger{color:#b91c1c!important}.hint{font-size:12px;color:#64748b;line-height:1.5}.draft-area{position:absolute;border:2px dashed #2563eb;background:#2563eb1f;pointer-events:none}
@media(max-width:900px){.topbar{align-items:flex-start;flex-direction:column}.toolbar{justify-content:flex-start}.layout{grid-template-columns:1fr}.note-list{max-height:none}}
`;

const REVIEW_SCRIPT = String.raw`
(()=>{
  'use strict';
  const dataNode=document.getElementById('review-data');
  let data=JSON.parse(dataNode.textContent||'{}');
  let dirty=false,tool=null,editingId=null,draft=null,dragStart=null,draftArea=null;
  const $=(selector)=>document.querySelector(selector);
  const layer=$('#note-layer'),list=$('#note-list'),editor=$('#note-editor'),form=$('#editor-form');
  const status=$('#status'),canvas=$('#canvas'),image=$('#page-screenshot');
  const kindLabel={point:'위치',area:'영역',text:'텍스트',comment:'일반 댓글'};
  const safeJson=(value)=>JSON.stringify(value).replaceAll('&','\\u0026').replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  const setStatus=(message)=>{status.textContent=message;status.dataset.dirty=String(dirty)};
  const setDirty=()=>{dirty=true;setStatus('저장하지 않은 변경사항이 있습니다. 수정본 다운로드로 보관하세요.')};
  const pointFromEvent=(event)=>{const rect=image.getBoundingClientRect();return{xRatio:Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),yRatio:Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))}};
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
  function render(){
    layer.replaceChildren();list.replaceChildren();
    data.notes.forEach((note,index)=>{
      if(note.type==='point'){
        const marker=make('button','marker',String(index+1));marker.type='button';marker.dataset.color=note.color;marker.title=note.content;marker.style.left=(note.position.xRatio*100)+'%';marker.style.top=(note.position.yRatio*100)+'%';marker.addEventListener('click',(event)=>{event.stopPropagation();openEdit(note.id)});layer.append(marker);
      }else if(note.type==='area'){
        const area=make('button','area');area.type='button';area.dataset.color=note.color;area.title=note.content;area.style.left=(note.position.xRatio*100)+'%';area.style.top=(note.position.yRatio*100)+'%';area.style.width=(note.position.widthRatio*100)+'%';area.style.height=(note.position.heightRatio*100)+'%';area.addEventListener('click',(event)=>{event.stopPropagation();openEdit(note.id)});layer.append(area);
      }
      const item=make('button','note-item');item.type='button';item.dataset.color=note.color;item.dataset.status=note.status;
      const head=make('span','note-kind');head.append(make('span','',kindLabel[note.type]||note.type),make('span','',note.status==='resolved'?'해결됨':(note.author||'작성자 없음')));
      item.append(head,make('div','note-content',note.content));item.addEventListener('click',()=>openEdit(note.id));list.append(item);
    });
    if(data.notes.length===0)list.append(make('p','empty','아직 메모가 없습니다. 위치, 영역 또는 일반 댓글을 추가해 보세요.'));
    document.querySelectorAll('[data-tool]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.tool===tool)));
  }
  function selectTool(next){tool=tool===next?null:next;draft=null;closeEditor();render();setStatus(tool==='point'?'스크린샷에서 메모할 위치를 클릭하세요.':tool==='area'?'스크린샷에서 메모할 영역을 드래그하세요.':tool==='comment'?'일반 댓글을 입력하세요.':'메모를 선택하거나 새 메모 도구를 고르세요.');if(tool==='comment')openCreate({type:'comment'})}
  function fillForm(note){form.elements.author.value=note.author||'';form.elements.content.value=note.content||'';form.elements.color.value=note.color||'yellow';form.elements.resolved.checked=note.status==='resolved'}
  function openCreate(nextDraft){editingId=null;draft=nextDraft;$('#editor-title').textContent='새 '+kindLabel[nextDraft.type];fillForm({});$('#delete-note').hidden=true;editor.hidden=false;form.elements.content.focus()}
  function openEdit(id){const note=data.notes.find((candidate)=>candidate.id===id);if(!note)return;editingId=id;draft=null;tool=null;$('#editor-title').textContent=kindLabel[note.type]+' 메모 수정';fillForm(note);$('#delete-note').hidden=false;editor.hidden=false;render()}
  function closeEditor(){editingId=null;draft=null;editor.hidden=true;form.reset()}
  form.addEventListener('submit',(event)=>{event.preventDefault();const values=new FormData(form);const content=String(values.get('content')||'').trim();if(!content)return;
    const now=new Date().toISOString(),author=String(values.get('author')||'').trim(),color=String(values.get('color')||'yellow'),status=form.elements.resolved.checked?'resolved':'open';
    if(editingId){const note=data.notes.find((candidate)=>candidate.id===editingId);if(note)Object.assign(note,{content,author,color,status,updatedAt:now});}
    else if(draft){data.notes.push({id:globalThis.crypto?.randomUUID?.()||('review-'+Date.now()),content,author,color,status:'open',origin:'review',createdAt:now,updatedAt:now,...draft});}
    closeEditor();tool=null;setDirty();render();
  });
  $('#cancel-edit').addEventListener('click',()=>{closeEditor();render()});
  $('#delete-note').addEventListener('click',()=>{if(!editingId||!confirm('이 메모를 삭제할까요?'))return;data.notes=data.notes.filter((note)=>note.id!==editingId);closeEditor();setDirty();render()});
  document.querySelectorAll('[data-tool]').forEach((button)=>button.addEventListener('click',()=>selectTool(button.dataset.tool)));
  canvas.addEventListener('click',(event)=>{if(tool!=='point'||event.target!==image)return;openCreate({type:'point',position:pointFromEvent(event)})});
  canvas.addEventListener('pointerdown',(event)=>{if(tool!=='area'||event.target!==image)return;dragStart=pointFromEvent(event);draftArea=make('div','draft-area');layer.append(draftArea);event.preventDefault()});
  canvas.addEventListener('pointermove',(event)=>{if(!dragStart||!draftArea)return;const current=pointFromEvent(event),x=Math.min(dragStart.xRatio,current.xRatio),y=Math.min(dragStart.yRatio,current.yRatio),w=Math.abs(current.xRatio-dragStart.xRatio),h=Math.abs(current.yRatio-dragStart.yRatio);Object.assign(draftArea.style,{left:(x*100)+'%',top:(y*100)+'%',width:(w*100)+'%',height:(h*100)+'%'})});
  canvas.addEventListener('pointerup',(event)=>{if(!dragStart)return;const current=pointFromEvent(event),position={xRatio:Math.min(dragStart.xRatio,current.xRatio),yRatio:Math.min(dragStart.yRatio,current.yRatio),widthRatio:Math.abs(current.xRatio-dragStart.xRatio),heightRatio:Math.abs(current.yRatio-dragStart.yRatio)};dragStart=null;draftArea?.remove();draftArea=null;if(position.widthRatio>.003&&position.heightRatio>.003)openCreate({type:'area',position})});
  $('#download-revision').addEventListener('click',()=>{const next=structuredClone(data);next.revision=(Number(next.revision)||1)+1;next.exportedAt=new Date().toISOString();const clone=document.documentElement.cloneNode(true);clone.querySelector('#review-data').textContent=safeJson(next);clone.querySelector('#note-layer').replaceChildren();clone.querySelector('#note-list').replaceChildren();clone.querySelector('#note-editor').hidden=true;clone.querySelector('#status').textContent='검토 파일을 열었습니다.';clone.querySelector('#status').dataset.dirty='false';const html='<!doctype html>\n'+clone.outerHTML;const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');const raw=next.source.kind==='local-file'?next.source.fileName:(next.source.displayName||'web-review');const base=raw.replace(/\.html?$/i,'').replace(/_rev\d+$/i,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim()||'web-review';anchor.href=url;anchor.download=base+'_rev'+next.revision+'.html';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);data=next;dataNode.textContent=safeJson(data);dirty=false;setStatus('revision '+data.revision+' 수정본을 다운로드했습니다.');render()});
  window.addEventListener('beforeunload',(event)=>{if(!dirty)return;event.preventDefault();event.returnValue='' });
  $('#source-name').textContent=data.source.displayName;$('#revision').textContent='revision '+data.revision;image.src=data.screenshot.dataUrl;image.alt=data.page.title+' 전체 페이지 캡처';canvas.style.setProperty('--capture-width',Math.max(1,data.screenshot.width)+'px');setStatus('메모를 선택하거나 새 메모 도구를 고르세요.');render();
})();
`;

export function generateReviewHtml(value: ExportDocumentV2 | unknown): string {
  const document = migrateExportDocument(value);
  const title = document.page.title || document.source.displayName || '검토 문서';
  const escapedTitle = title
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="${EXPORT_MARKER_NAME}" content="2">
  <title>${escapedTitle} - 검토</title>
  <style>${REVIEW_STYLES}</style>
</head>
<body>
  <main class="app">
    <header class="topbar">
      <div class="title"><h1 id="source-name"></h1><div class="meta"><span id="revision"></span> · 로컬 단일 HTML 검토 파일</div></div>
      <nav class="toolbar" aria-label="메모 도구">
        <button type="button" data-tool="point" aria-pressed="false">위치 메모</button>
        <button type="button" data-tool="area" aria-pressed="false">영역 메모</button>
        <button type="button" data-tool="comment" aria-pressed="false">일반 댓글</button>
        <button type="button" id="download-revision" class="save">수정본 다운로드</button>
      </nav>
    </header>
    <div id="status" class="status" role="status" data-dirty="false"></div>
    <div class="layout">
      <section class="canvas-shell" aria-label="페이지 캡처">
        <div id="canvas" class="canvas"><img id="page-screenshot"><div id="note-layer" class="note-layer"></div></div>
      </section>
      <aside class="side">
        <section class="panel"><h2>메모</h2><div id="note-list" class="note-list"></div></section>
        <section id="note-editor" class="panel editor" hidden>
          <h2 id="editor-title">메모 편집</h2>
          <form id="editor-form">
            <label>작성자<input name="author" autocomplete="off"></label>
            <label>메모 내용<textarea name="content" required></textarea></label>
            <label>색상<select name="color"><option value="yellow">노랑</option><option value="red">빨강</option><option value="green">초록</option><option value="blue">파랑</option><option value="purple">보라</option></select></label>
            <label class="resolved-row"><input type="checkbox" name="resolved"> 해결됨</label>
            <div class="form-actions"><button type="button" id="delete-note" class="danger">삭제</button><span class="spacer"></span><button type="button" id="cancel-edit">취소</button><button type="submit" class="primary">저장</button></div>
          </form>
        </section>
        <section class="panel hint">변경사항은 현재 브라우저 메모리에만 있습니다. 원본 파일은 수정되지 않으므로 작업 후 반드시 <strong>수정본 다운로드</strong>를 누르세요.</section>
      </aside>
    </div>
  </main>
  <script id="${EXPORT_DATA_ELEMENT_ID}" type="application/json">${serializeExportData(document)}</script>
  <script>${REVIEW_SCRIPT}</script>
</body>
</html>`;
}
