const axios = require('axios');
const sharp = require('sharp');

async function uploadToGitHub(fileBuffer, originalName, folder = 'products') {
  try {
    // 1. Image Compress
    const compressedBuffer = await sharp(fileBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const cleanName = originalName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${folder}/${Date.now()}_${cleanName}.webp`;
    const contentBase64 = compressedBuffer.toString('base64');

    // 2. GitHub API URL
    const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${fileName}`;

    // 3. Axios se Push Karein (Bypass Octokit/Undici bugs)
    await axios.put(
      url,
      {
        message: `Upload image: ${fileName}`,
        content: contentBase64,
        branch: process.env.GITHUB_BRANCH || 'main'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 4. Raw URL Return Karein
    return `https://raw.githubusercontent.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/${process.env.GITHUB_BRANCH || 'main'}/${fileName}`;
  } catch (err) {
    // Agar koi API error aati hai toh detail mein console par dikhegi
    console.error('GitHub Upload Error:', err.response ? err.response.data : err.message);
    throw new Error('Image compress ya upload hone mein fail ho gayi');
  }
}
const deleteFromGitHub = async (fileUrl) => {
  if (!fileUrl || !fileUrl.includes('raw.githubusercontent.com')) return false;

  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;

    const branchIndex = fileUrl.indexOf(`/${branch}/`);
    if (branchIndex === -1) return false;

    const filePath = fileUrl.substring(branchIndex + branch.length + 2);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // 1. File ka SHA nikalne ke liye GET request
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!getRes.ok) return false; // File already nahi hai

    const fileData = await getRes.json();
    
    // 2. SHA milne ke baad DELETE request bhejenge
    const deleteRes = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Deleted ${filePath} via Background Process`,
        sha: fileData.sha,
        branch: branch
      })
    });

    if (deleteRes.ok) {
      console.log(`🗑️ Background Delete Success: ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('❌ GitHub delete API error:', err);
    return false;
  }
};


module.exports = { uploadToGitHub, deleteFromGitHub };