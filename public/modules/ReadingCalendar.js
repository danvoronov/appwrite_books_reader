// Календарь чтения: строит месячную сетку по данным Moon+ Reader
// Источник данных: output/moonreader_notes.json (содержит time ISO и book)
// Простая агрегация по дням: какие книги и сколько заметок/цитат было в каждый день

export class ReadingCalendar {
  constructor() {
    this.data = [];
    this.daily = new Map(); // key: 'YYYY-MM-DD' -> { count, books: Map(book->count) }
  }

  async load() {
    try {
      const res = await fetch('/output/moonreader_notes.json');
      if (!res.ok) throw new Error('moonreader_notes.json not found');
      this.data = await res.json();
      this.buildDailyIndex();
      return true;
    } catch (e) {
      console.warn('Reading calendar data not available:', e.message);
      return false;
    }
  }

  buildDailyIndex() {
    this.daily.clear();
    for (const it of this.data) {
      if (!it.time) continue;
      const day = it.time.slice(0,10); // YYYY-MM-DD
      let rec = this.daily.get(day);
      if (!rec) {
        rec = { count: 0, books: new Map() };
        this.daily.set(day, rec);
      }
      rec.count++;
      const book = it.book || it.filename || 'Unknown';
      rec.books.set(book, (rec.books.get(book) || 0) + 1);
    }
  }

  getMonthDays(year, month) {
    // month: 1..12
    const first = new Date(Date.UTC(year, month-1, 1));
    const last = new Date(Date.UTC(year, month, 0));
    const days = [];
    for (let d = 1; d <= last.getUTCDate(); d++) {
      const iso = new Date(Date.UTC(year, month-1, d)).toISOString().slice(0,10);
      const rec = this.daily.get(iso) || { count: 0, books: new Map() };
      const books = Array.from(rec.books.entries()).sort((a,b)=>b[1]-a[1]).map(([name,cnt])=>({name,cnt}));
      days.push({ iso, count: rec.count, books });
    }
    return days;
  }

  render(container, year, month) {
    const days = this.getMonthDays(year, month);
    const title = `${year}-${String(month).padStart(2,'0')}`;
    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <div><strong>📅 Календарь чтения: ${title}</strong></div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary" id="calPrev">◀</button>
          <button class="btn btn-secondary" id="calNext">▶</button>
        </div>
      </div>
      <div class="cal-grid" style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;">
        ${days.map(d=>`
          <div class="cal-day" data-day="${d.iso}" style="border:1px solid #eee; border-radius:6px; padding:6px; min-height:80px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:0.9em; color:#6c757d;">${d.iso.slice(8)}</span>
              <span style="font-size:0.85em; color:${d.count>0?'#2ecc71':'#aaa'};">${d.count}</span>
            </div>
            ${d.books.slice(0,3).map(b=>`<div style="font-size:0.8em; color:#444;">${b.name} <span style="color:#888;">(${b.cnt})</span></div>`).join('')}
          </div>
        `).join('')}
      </div>
    `;

    const cur = new Date(Date.UTC(year, month-1, 1));
    const prev = () => { const p = new Date(cur); p.setUTCMonth(cur.getUTCMonth()-1); return [p.getUTCFullYear(), p.getUTCMonth()+1]; };
    const next = () => { const n = new Date(cur); n.setUTCMonth(cur.getUTCMonth()+1); return [n.getUTCFullYear(), n.getUTCMonth()+1]; };
    const rerender = (y,m) => this.render(container, y, m);
    container.querySelector('#calPrev').addEventListener('click', ()=>{ const [y,m]=prev(); rerender(y,m); });
    container.querySelector('#calNext').addEventListener('click', ()=>{ const [y,m]=next(); rerender(y,m); });
  }
}
