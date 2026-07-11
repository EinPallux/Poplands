import { App } from '@/app/App';
import '@/style.css';

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui') as HTMLDivElement | null;

if (!canvas || !uiRoot) {
  throw new Error('index.html is missing #scene or #ui');
}

void App.boot(canvas, uiRoot);
