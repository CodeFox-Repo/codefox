import { sharedPagePath } from '../shared-page-path';

const ID = '11111111-2222-3333-4444-555555555555';
const at = (path: string) => sharedPagePath(path, ID);

describe('sharedPagePath', () => {
  it('serves the home page for the bare link', () => {
    expect(at(`/share/${ID}`)).toBe('index.html');
    expect(at(`/share/${ID}/`)).toBe('index.html');
  });

  it('follows a link to another page of the site', () => {
    // Exactly what the agent is instructed to write: <a href="about.html">.
    expect(at(`/share/${ID}/about.html`)).toBe('about.html');
    expect(at(`/share/${ID}/pages/contact.html`)).toBe('pages/contact.html');
    // Spaces are refused: the charset is deliberately narrow, and the
    // agent writes hyphenated filenames.
    expect(at(`/share/${ID}/a%20b.html`)).toBeNull();
  });

  it('serves only html', () => {
    // The route answers as text/html and without a session; the project's
    // other files are not published just because the project is.
    expect(at(`/share/${ID}/.env`)).toBeNull();
    expect(at(`/share/${ID}/notes.md`)).toBeNull();
    expect(at(`/share/${ID}/script.js`)).toBeNull();
    expect(at(`/share/${ID}/index.html.bak`)).toBeNull();
  });

  it('refuses traversal in every spelling', () => {
    expect(at(`/share/${ID}/../../etc/passwd`)).toBeNull();
    expect(at(`/share/${ID}/..%2f..%2fsecret.html`)).toBeNull();
    expect(at(`/share/${ID}/%2e%2e/x.html`)).toBeNull();
    expect(at(`/share/${ID}/a/../../b.html`)).toBeNull();
    expect(at(`/share/${ID}/..`)).toBeNull();
  });

  it('refuses separators and terminators that mean something elsewhere', () => {
    expect(at(`/share/${ID}/a\\b.html`)).toBeNull();
    expect(at(`/share/${ID}/a%00.html`)).toBeNull();
    expect(at(`/share/${ID}//double.html`)).toBeNull();
    expect(at(`/share/${ID}/deep/er/nested.html`)).toBeNull();
  });

  it('refuses a directory and a malformed encoding', () => {
    expect(at(`/share/${ID}/pages/`)).toBeNull();
    expect(at(`/share/${ID}/%zz.html`)).toBeNull();
  });

  it('refuses a path belonging to a different share', () => {
    expect(at('/share/99999999-2222-3333-4444-555555555555/x.html')).toBeNull();
    expect(at('/elsewhere/x.html')).toBeNull();
  });

  it('ignores a query string', () => {
    expect(at(`/share/${ID}/about.html?utm=x`)).toBe('about.html');
  });
});
