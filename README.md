# mattrude.org - Personal Website

This repository contains the source code for my personal website at [mattrude.org](https://mattrude.org).

## About This Site

This website serves as my personal platform for:
- Sharing my professional experience and resume
- Publishing blog posts about technology and software development
- Creating instructional guides and tutorials

The site is built with a focus on:
- Performance and simplicity
- Accessibility and inclusivity
- Minimalist design using vanilla HTML, CSS, and JavaScript

## Project Structure

```
mattrude.org/
├── index.html                 # Homepage with blog posts
├── feed.xml                   # RSS feed
├── resume/                    # Resume page directory
│   └── index.html            
├── blog/                      # Blog posts directory
│   ├── template.html          # Template for new posts
│   ├── post-index.json        # Auto-generated index of all posts
│   └── posts/                 # Individual blog post files
│       └── 2025-03-25-launching-my-personal-website.html
├── assets/
│   ├── css/                   # Stylesheet files
│   │   └── main.css           # Main styles
│   ├── js/                    # JavaScript files
│   │   └── blog.js            # Self-initializing blog functionality
│   └── images/                # Image assets
│       ├── cloudflare-icon.svg  # Cloudflare icon
│       └── favicon/           # Favicon and app icons
│           ├── favicon.ico
│           ├── favicon.svg
│           ├── apple-touch-icon.png
│           ├── favicon-96x96.png
│           ├── web-app-manifest-192x192.png
│           ├── web-app-manifest-512x512.png
│           └── site.webmanifest
├── tools/                     # Development tools
│   ├── generate-index.js      # Blog index generator
│   └── generate-feed.js       # RSS feed generator
└── README.md                  # This file
```

## Development Workflow

This site is automatically deployed to Cloudflare Pages when changes are pushed to the main branch of this repository.

### Adding a New Blog Post

To add a new blog post:

1. **Create a new HTML file** in the `blog/posts/` directory:
   - Use the naming convention: `YYYY-MM-DD-descriptive-title.html`
   - Copy `blog/template.html` as a starting point

2. **Add metadata to the post** at the top of the file in a comment block:
   ```html
   <!--
   BLOG_META
   {
     "title": "Your Post Title",
     "date": "YYYY-MM-DD",
     "description": "A brief description for the homepage and RSS feed",
     "tags": ["tag1", "tag2"]
   }
   END_BLOG_META
   -->
   ```

3. **Write your content** in the `post-content` section

4. **Generate the post index and RSS feed**:
   ```
   node tools/generate-index.js && node tools/generate-feed.js
   ```
   This will scan all blog posts, create/update the `blog/post-index.json` file, and generate the RSS feed

5. **Commit and push** your changes to GitHub

The homepage will automatically list your new post based on the metadata, and posts can be filtered by tags.

### Local Development

To test the site locally:

1. Navigate to the project root directory:
   ```
   cd /path/to/mattrude.org
   ```

2. Start a local server (using Python for example):
   ```
   python3 -m http.server 8000
   ```

3. Open your browser to http://localhost:8000/

**Important**: Always run the development server from the project root directory, not from subdirectories, to ensure paths resolve correctly.

## RSS Feed

The site includes an RSS feed at `/feed.xml` that is automatically generated from the blog post index. The feed includes full content from each post with properly formatted images and links.

The RSS feed is generated using the `generate-feed.js` script in the tools directory, which converts relative URLs to absolute URLs to ensure all resources display correctly in feed readers.

## Features

- **Dynamic blog listing** - Blog posts are loaded from a central index file for better performance
- **Tag filtering** - Posts can be filtered by tags on the homepage
- **Self-initializing JavaScript** - The blog.js file handles all functionality without dependencies
- **Cloudflare integration** - Cloudflare icon is automatically added next to mentions of "Cloudflare"
- **Auto-generated RSS feed** - Full content is available via RSS with properly converted image URLs
- **Favicon support** - Complete set of favicon and touch icons for all platforms
- **Responsive design** - Site works well on all device sizes

## Implementation Details

- The site uses vanilla JavaScript with no frameworks or libraries
- Blog posts are stored as individual HTML files with metadata in HTML comments
- Blog listing on the homepage uses a pre-generated JSON index file for better performance
- The blog.js script includes debug logs that can be viewed in the browser console

## License

© 2025 Matt Rude. All rights reserved.