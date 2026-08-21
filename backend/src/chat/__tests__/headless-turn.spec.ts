import { HeadlessResponse } from '../headless-turn';

/**
 * The event shapes are the ones `ChatController.runTurn` actually writes —
 * one JSON object per line, `t` of text / tool / error / lint. If this drifts
 * from that writer, a headless turn saves the wrong reply (or none), which is
 * silent: the files still change and the chat just looks like the agent said
 * nothing.
 */
describe('HeadlessResponse', () => {
  it('folds the stream into the reply and steps a browser would save', () => {
    const res = new HeadlessResponse();
    res.write(`${JSON.stringify({ t: 'text', v: 'Making ' })}\n`);
    res.write(`${JSON.stringify({ t: 'text', v: 'the hero.' })}\n`);
    res.write(
      `${JSON.stringify({ t: 'tool', v: 'Edit', arg: 'index.html' })}\n`,
    );
    res.write(`${JSON.stringify({ t: 'text', v: ' Done.' })}\n`);
    res.write(`${JSON.stringify({ t: 'lint', v: [{ id: 'contrast' }] })}\n`);
    res.end();

    expect(res.reply).toBe('Making the hero. Done.');
    expect(res.steps).toEqual([
      { kind: 'text', text: 'Making the hero.' },
      { kind: 'tool', tool: 'Edit', file: 'index.html' },
      { kind: 'text', text: ' Done.' },
    ]);
  });

  it('survives an event split across two writes', () => {
    const line = `${JSON.stringify({ t: 'text', v: 'half' })}\n`;
    const res = new HeadlessResponse();
    res.write(line.slice(0, 9));
    res.write(line.slice(9));
    res.end();

    expect(res.reply).toBe('half');
  });

  it('keeps errors out of the reply', () => {
    const res = new HeadlessResponse();
    res.write(`${JSON.stringify({ t: 'text', v: 'Trying' })}\n`);
    res.write(`${JSON.stringify({ t: 'error', v: 'out of credit' })}\n`);
    res.end();

    expect(res.reply).toBe('Trying');
    expect(res.errors).toEqual(['out of credit']);
  });

  /** A refused turn never streams; the controller answers with json. */
  it('records a refusal and settles', async () => {
    const res = new HeadlessResponse();
    res.status(429).json({ error: 'too many turns' });

    await res.done;
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'too many turns' });
    expect(res.writableEnded).toBe(true);
  });

  it('settles exactly once, when the turn ends', async () => {
    const res = new HeadlessResponse();
    let settled = false;
    void res.done.then(() => (settled = true));

    res.write(`${JSON.stringify({ t: 'text', v: 'hi' })}\n`);
    await Promise.resolve();
    expect(settled).toBe(false);

    res.end();
    await res.done;
    expect(settled).toBe(true);
  });
});
