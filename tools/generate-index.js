/**
 * generate-index.js
 * 
 * This script scans blog post HTML files, extracts metadata from comments,
 * and generates a single JSON index file for improved performance.
 * 
 * After running this script, you should also run generate-feed.js to update the RSS feed:
 * node tools/generate-index.js && node tools/generate-feed.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const POSTS_DIR = path.join(__dirname, '..', 'blog', 'posts');
const INDEX_PATH = path.join(__dirname, '..', 'blog', 'post-index.json');

// Main function
function generateIndex() {
  console.log('Generating blog post index...');
  
  try {
    // Ensure posts directory exists
    if (!fs.existsSync(POSTS_DIR)) {
      console.error(`Posts directory not found: ${POSTS_DIR}`);
      process.exit(1);
    }
    
    // Get all HTML files in the posts directory
    const postFiles = fs.readdirSync(POSTS_DIR)
      .filter(file => file.endsWith('.html'));
    
    if (postFiles.length === 0) {
      console.warn('No blog posts found. Index will be empty.');
    }
    
    // Extract metadata from each post
    const posts = postFiles.map(file => {
      const filePath = path.join(POSTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      return extractMetadata(content, file);
    });
    
    // Sort posts by date (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Create the index object
    const index = {
      posts,
      generated: new Date().toISOString(),
      count: posts.length
    };
    
    // Write the index file
    fs.writeFileSync(
      INDEX_PATH,
      JSON.stringify(index, null, 2),
      'utf8'
    );
    
    console.log(`Successfully generated index with ${posts.length} posts.`);
    console.log(`Index file saved to: ${INDEX_PATH}`);
    
  } catch (error) {
    console.error('Error generating index:', error);
    process.exit(1);
  }
}

/**
 * Extract metadata from a blog post HTML file
 * 
 * @param {string} content - HTML content of the blog post
 * @param {string} filename - Name of the blog post file
 * @returns {object} Post metadata
 */
function extractMetadata(content, filename) {
  // Try to extract metadata from HTML comment
  const metaMatch = content.match(/<!--\s*BLOG_META\s*({[\s\S]*?})\s*END_BLOG_META\s*-->/);
  
  if (metaMatch && metaMatch[1]) {
    try {
      const metadata = JSON.parse(metaMatch[1]);
      metadata.file = filename;
      return metadata;
    } catch (e) {
      console.warn(`Error parsing metadata in ${filename}:`, e);
    }
  }
  
  // Fallback: Extract basic metadata from HTML
  console.warn(`Using fallback metadata extraction for ${filename}`);
  
  const titleMatch = content.match(/<title>(.*?)<\/title>/);
  const dateMatch = content.match(/<div class="post-meta">(.*?)<\/div>/);
  const descriptionMatch = content.match(/<meta name="description" content="(.*?)"\s*\/?>/);
  
  // Extract date from filename (format: YYYY-MM-DD-title.html)
  const dateFromFilename = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  
  return {
    title: titleMatch 
      ? titleMatch[1].replace(' | Matt Rude', '') 
      : filename.replace('.html', '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '),
    date: dateMatch 
      ? dateMatch[1] 
      : (dateFromFilename ? dateFromFilename[1] : 'Unknown date'),
    description: descriptionMatch 
      ? descriptionMatch[1] 
      : 'No description available',
    file: filename,
    tags: [] // Default empty tags array
  };
}

// Run the script
generateIndex();