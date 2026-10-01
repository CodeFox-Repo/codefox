"use client";
import React, { useMemo, useRef, useState } from 'react';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { Toaster } from 'sonner';
import { loader } from '@monaco-editor/react';
loader.config({ paths: { vs: '/fixture-vs' } });
import { CodeEngine } from '@/components/chat/code-engine/code-engine';
import CodeTab from '@/components/chat/code-engine/tabs/code-tab';
import SaveChangesBar from '@/components/chat/code-engine/save-changes-bar';
import WebPreview from '@/components/chat/code-engine/web-view';
import { DeployDialog } from '@/components/chat/code-engine/deploy-dialog';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
const pending = new Promise<any>(() => {});
const fixtureFetch = async (url: any) => {
  const path = String(url);
  if (path.includes('/versions')) return new Response('{}', { status: 503 });
  if (path.includes('/changes')) return new Response(JSON.stringify({changes: []}));
  throw new Error('Unconfigured local fixture request: ' + path);
};
if (typeof window !== 'undefined') {
  window.fetch = fixtureFetch as any;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => { const denied = Promise.reject(new Error('Simulated clipboard permission denial')); denied.catch(() => {}); return denied; } } });
}
export default function Fixture() {
  const mode = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('case');
  const [filePath, setFilePath] = useState<string | null>('index.html');
  const editorRef = useRef(null);
  const client = useMemo(() => new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink(() => new Observable((observer) => {
    observer.next({ data: { deployProject: { __typename:'DeployResult', ok:true, url:'https://fixture.example.test/codefox-deployment', message:'' } } }); observer.complete();
  })) }), []);
  const context = useMemo(() => ({curProject:null, projectLoading:false, pollChatProject:() => pending, editorRef, turnsDone:0, turnFinished:()=>{},getWebUrl:()=>pending}),[]);
  return <ApolloProvider client={client}><ProjectContext.Provider value={context as any}>
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b p-4 text-sm">LOCAL CODEFOX FIXTURE · Real components · Mocked context/API · No external requests</header>
      {mode === 'preparing' && <CodeEngine chatId="offline-fixture" isProjectReady={false} />}
      {mode === 'history' && <div className="flex h-[75vh]"><CodeTab editorRef={editorRef} projectPath="offline-fixture" fileStructureData={{}} newCode="// Editor fixture, no live project" isFileStructureLoading={false} updateSavingStatus={()=>{}} filePath={filePath} setFilePath={setFilePath} /></div>}
      {mode === 'save-mobile' && <div className="p-6"><p>320px iframe viewport</p><iframe title="320px save bar fixture" src="/editor-feedback-fixture?case=save" style={{width:320,height:650,border:'1px solid #999'}} /></div>}
      {mode === 'save' && <><div className="p-6"><h1>index.html</h1><textarea className="mt-4 w-full border p-3" aria-label="Fixture edit" defaultValue="My unsaved edit"/><p className="mt-4 text-sm text-muted-foreground">Layout fixture for the actual save bar; save failure behavior is covered by component tests.</p></div><SaveChangesBar onSave={()=>{}} onReset={()=>{}} /></>}
      {mode === 'deploy' && <DeployDialog projectId="fixture-project" open onOpenChange={()=>{}} />}
      {mode === 'preview' && <div className="h-[75vh]"><WebPreview project={{id:'fixture', projectPath:'fixture',template:'next'}} /></div>}
      <Toaster />
    </div>
  </ProjectContext.Provider></ApolloProvider>;
}
