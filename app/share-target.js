import { saveSharedFile } from './share-inbox.js';
export async function receiveShare(request, scope) {
  const destination = new URL('./', scope);
  let file;
  try {
    const form = await request.formData();
    const files = form.getAll('books');
    if (files.length !== 1 || typeof files[0] === 'string' || !files[0].size) throw new Error();
    file = files[0];
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') throw new Error();
  } catch {
    destination.searchParams.set('share-error', 'file');
    return Response.redirect(destination.href, 303);
  }
  try {
    const id = await saveSharedFile({ name: file.name, text: await file.text() });
    destination.searchParams.set('share', id);
  } catch {
    destination.searchParams.set('share-error', 'storage');
  }
  return Response.redirect(destination.href, 303);
}
