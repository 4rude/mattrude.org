/**
 * generate-feed.js
 * 
 * This script generates an RSS feed (feed.xml) from the blog post index file.
 * It extracts full post content from each blog post HTML file and converts
 * all relative URLs to absolute URLs.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const INDEX_PATH = path.join(__dirname, '..', 'blog', 'post-index.json');
const FEED_PATH = path.join(__dirname, '..', 'feed.xml');
const POSTS_DIR = path.join(__dirname, '..', 'blog', 'posts');
const SITE_URL = 'https://mattrude.org';
const FEED_TITLE = 'Matt Rude\'s Blog';
const FEED_DESCRIPTION = 'Practical guides, tutorials, and insights on building powerful technology solutions without the enterprise price tag. Making technology accessible for everyone.';
const FEED_LANGUAGE = 'en-us';
const FEED_COPYRIGHT = `© ${new Date().getFullYear()} Matt Rude. All rights reserved.`;
const FEED_CATEGORIES = ['Technology', 'Software Development', 'Accessibility'];

// Main function
function generateFeed() {
  console.log('Generating RSS feed...');
  
  try {
    // Read the post index file
    if (!fs.existsSync(INDEX_PATH)) {
      console.error(`Index file not found: ${INDEX_PATH}`);
      process.exit(1);
    }
    
    const indexData = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const posts = indexData.posts || [];
    
    if (posts.length === 0) {
      console.warn('No blog posts found. Feed will have no items.');
    }
    
    // Format the current date for lastBuildDate
    const buildDate = formatRSSDate(new Date());
    
    // Start building the RSS XML
    let rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${FEED_TITLE}</title>
    <description>${FEED_DESCRIPTION}</description>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <language>${FEED_LANGUAGE}</language>
    <copyright>${FEED_COPYRIGHT}</copyright>
    <lastBuildDate>${buildDate}</lastBuildDate>
`;
    
    // Add categories
    FEED_CATEGORIES.forEach(category => {
      rssXml += `    <category>${category}</category>\n`;
    });
    
    // Add items for each post
    posts.forEach(post => {
      rssXml += createItemXml(post);
    });
    
    // Close the RSS XML
    rssXml += `  </channel>
</rss>`;
    
    // Write the feed file
    fs.writeFileSync(FEED_PATH, rssXml, 'utf8');
    
    console.log(`Successfully generated RSS feed with ${posts.length} posts.`);
    console.log(`Feed file saved to: ${FEED_PATH}`);
    console.log('\nRemember: Whenever you add a new blog post, run both scripts:');
    console.log('node tools/generate-index.js && node tools/generate-feed.js');
    
  } catch (error) {
    console.error('Error generating feed:', error);
    process.exit(1);
  }
}

/**
 * Create XML for a single RSS item with full post content
 * 
 * @param {Object} post - Post data from the index
 * @returns {string} XML for the item
 */
function createItemXml(post) {
  const pubDate = formatRSSDate(new Date(post.date));
  const link = `${SITE_URL}/blog/posts/${post.file}`;
  const postUrl = `/blog/posts/${post.file}`;
  
  // Read the full blog post HTML
  const postPath = path.join(POSTS_DIR, post.file);
  let fullContent = '';
  
  try {
    const postContent = fs.readFileSync(postPath, 'utf8');
    
    // Extract the content from the HTML
    const contentMatch = postContent.match(/<div class="post-content">([\s\S]*?)<\/div>/);
    let extractedContent = contentMatch ? contentMatch[1].trim() : '';
    
    // Convert relative URLs to absolute URLs
    if (extractedContent) {
      fullContent = convertRelativeUrls(extractedContent, SITE_URL, postUrl);
    } else {
      console.warn(`Could not extract content for post: ${post.file}, using description instead.`);
      fullContent = `<p>${post.description}</p>`;
    }
  } catch (error) {
    console.error(`Error reading post file: ${post.file}`, error);
    fullContent = `<p>${post.description}</p>`;
  }
  
  let itemXml = `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[
        ${fullContent}
        
        <p><a href="${link}">View original post</a></p>
      ]]></description>`;
  
  // Add tags as categories
  if (post.tags && post.tags.length > 0) {
    post.tags.forEach(tag => {
      itemXml += `\n      <category>${tag}</category>`;
    });
  }
  
  itemXml += `\n    </item>\n`;
  return itemXml;
}

/**
 * Convert all relative URLs in HTML content to absolute URLs
 * 
 * @param {string} html - HTML content with relative URLs
 * @param {string} baseUrl - Base URL of the website
 * @param {string} postUrl - URL of the current post (for resolving relative paths)
 * @returns {string} HTML content with absolute URLs
 */
function convertRelativeUrls(html, baseUrl, postUrl) {
  // Remove trailing slash from baseUrl if present
  baseUrl = baseUrl.replace(/\/$/, '');
  
  // Get the post's directory path for resolving relative URLs
  const postDir = path.dirname(postUrl);
  
  // Process different types of attributes that might contain URLs
  // 1. Image sources
  html = html.replace(/(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
    return prefix + resolveUrl(url, baseUrl, postDir) + suffix;
  });
  
  // 2. Hyperlinks
  html = html.replace(/(<a[^>]+href=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
    return prefix + resolveUrl(url, baseUrl, postDir) + suffix;
  });
  
  // 3. Other media elements (video, audio, embed, source)
  html = html.replace(/(<(?:video|audio|embed|source)[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
    return prefix + resolveUrl(url, baseUrl, postDir) + suffix;
  });
  
  // 4. CSS background images in inline styles
  html = html.replace(/(style=["'][^"']*background(?:-image)?:\s*url\(["']?)([^"')]+)(["']?\)[^"']*["'])/gi, (match, prefix, url, suffix) => {
    return prefix + resolveUrl(url, baseUrl, postDir) + suffix;
  });
  
  return html;
}

/**
 * Resolve a relative URL to an absolute URL
 * 
 * @param {string} url - The URL to resolve
 * @param {string} baseUrl - The base URL of the website
 * @param {string} postDir - The directory path of the current post
 * @returns {string} The absolute URL
 */
function resolveUrl(url, baseUrl, postDir) {
  // Skip URLs that are already absolute
  if (url.match(/^(https?:)?\/\//i)) {
    return url;
  }
  
  // Skip mailto: links and other special protocols
  if (url.match(/^(mailto|tel|ftp|javascript):/i)) {
    return url;
  }
  
  // Skip anchors that only reference elements on the same page
  if (url.startsWith('#')) {
    return url;
  }
  
  // Handle root-relative URLs (starting with /)
  if (url.startsWith('/')) {
    return baseUrl + url;
  }
  
  // Handle relative URLs (not starting with /)
  // For images and resources in blog posts, resolve relative to the post's directory
  return baseUrl + path.join(postDir, url).replace(/\\/g, '/');
}

/**
 * Format a date for RSS (RFC 822)
 * 
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatRSSDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = days[date.getDay()];
  const dayNum = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const time = date.toTimeString().slice(0, 8);
  const timezone = '-0500'; // This is hardcoded, but could be dynamic
  
  return `${day}, ${dayNum < 10 ? '0' + dayNum : dayNum} ${month} ${year} ${time} ${timezone}`;
}

/**
 * Escape XML special characters
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Run the script
generateFeed();