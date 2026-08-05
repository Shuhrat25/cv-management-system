export async function uploadToDropbox(fileName: string, content: object): Promise<void> {
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DROPBOX_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: `/${fileName}`,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
    },
    body: JSON.stringify(content, null, 2),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Dropbox upload failed: ${response.status} ${errText}`);
  }
}