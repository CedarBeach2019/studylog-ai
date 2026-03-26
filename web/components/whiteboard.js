// ─── Whiteboard — Canvas drawing component (Preact+HTM) ──────────────────
import { h, Component } from 'preact';
import { html } from 'htm/preact';

export class Whiteboard extends Component {
  canvasRef = null;
  state = {
    tool: 'pen', // pen | eraser | text
    color: '#1e293b',
    lineWidth: 3,
    isDrawing: false,
    history: [],
    textMode: false,
  };

  componentDidMount() {
    const canvas = this.canvasRef;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.resize();
  }

  resize = () => {
    const canvas = this.canvasRef;
    if (!canvas || !this.ctx) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 400;
    this.redraw();
  };

  getPos = (e) => {
    const canvas = this.canvasRef;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  startDraw = (e) => {
    if (this.state.tool === 'text') return;
    e.preventDefault();
    const pos = this.getPos(e);
    this.setState({ isDrawing: true });
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  };

  draw = (e) => {
    if (!this.state.isDrawing) return;
    e.preventDefault();
    const pos = this.getPos(e);
    const { tool, color, lineWidth } = this.state;

    if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = lineWidth * 5;
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth;
    }

    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
  };

  endDraw = (e) => {
    if (!this.state.isDrawing) return;
    this.setState({ isDrawing: false });
    this.ctx.globalCompositeOperation = 'source-over';
    // Save state for undo
    if (this.canvasRef) {
      this.setState(prev => ({
        history: [...prev.history, this.canvasRef.toDataURL()].slice(-20),
      }));
    }
  };

  undo = () => {
    const { history } = this.state;
    if (history.length < 2) {
      this.ctx.clearRect(0, 0, this.canvasRef.width, this.canvasRef.height);
      return;
    }
    const prev = history[history.length - 2];
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvasRef.width, this.canvasRef.height);
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
    this.setState(prev => ({ history: prev.history.slice(0, -1) }));
  };

  clear = () => {
    this.ctx.clearRect(0, 0, this.canvasRef.width, this.canvasRef.height);
    this.setState({ history: [] });
  };

  handleCanvasClick = (e) => {
    if (this.state.tool !== 'text') return;
    const text = prompt('Enter text:');
    if (!text) return;
    const pos = this.getPos(e);
    this.ctx.font = `${Math.max(14, this.state.lineWidth * 5)}px sans-serif`;
    this.ctx.fillStyle = this.state.color;
    this.ctx.fillText(text, pos.x, pos.y);
  };

  redraw = () => {
    // Minimal redraw - just clear
    if (this.ctx && this.canvasRef) {
      this.ctx.clearRect(0, 0, this.canvasRef.width, this.canvasRef.height);
    }
  };

  render() {
    const { tool, color, lineWidth } = this.state;
    const colors = ['#1e293b', '#dc2626', '#16a34a', '#2563eb', '#7c3aed', '#ea580c'];

    return html`
      <div class="whiteboard-container">
        <div class="whiteboard-toolbar">
          ${['pen', 'eraser', 'text'].map(t => html`
            <button key=${t} class="wb-tool ${tool === t ? 'active' : ''}"
              onClick=${() => this.setState({ tool: t })}>
              ${t === 'pen' ? '✏️ Pen' : t === 'eraser' ? '🧹 Eraser' : '🔤 Text'}
            </button>
          `)}
          <span style="margin:0 8px;color:var(--study-border)">|</span>
          ${colors.map(c => html`
            <button key=${c} class="wb-color ${color === c ? 'active' : ''}"
              style=${{ background: c }}
              onClick=${() => this.setState({ color: c })}></button>
          `)}
          <span style="margin-left:auto">
            <button class="wb-tool" onClick=${this.undo}>↩ Undo</button>
            <button class="wb-tool" onClick=${this.clear}>🗑 Clear</button>
          </span>
        </div>
        <canvas ref=${el => this.canvasRef = el} class="whiteboard-canvas"
          onMouseDown=${this.startDraw} onMouseMove=${this.draw} onMouseUp=${this.endDraw} onMouseLeave=${this.endDraw}
          onTouchStart=${this.startDraw} onTouchMove=${this.draw} onTouchEnd=${this.endDraw}
          onClick=${this.handleCanvasClick}></canvas>
      </div>
    `;
  }
}
