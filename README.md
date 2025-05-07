# mattrude.org - Personal Website

This repository contains the source code for my personal website at [mattrude.org](https://mattrude.org).

## About This Site

This website serves as my personal platform for:
- Sharing my professional experience and resume
- Publishing blog posts about technology and software development
- Creating instructional guides and tutorials
- Sharing annotations of select papers and blogs

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
├── annotations/               # Annotations section
│   ├── index.html             # Main annotations page
│   ├── template-paper.html    # Template for paper annotations
│   ├── template-book.html     # Template for book annotations
│   ├── annotation-index.json  # Auto-generated index of all annotations
│   └── entries/               # Individual annotation files
├── assets/
│   ├── css/                   # Stylesheet files
│   │   └── main.css           # Main styles
│   ├── js/                    # JavaScript files
│   │   ├── blog.js            # Self-initializing blog functionality
│   │   └── annotations.js     # Annotations functionality
│   ├── pdfs/                  # PDF files for annotations and reference
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
│   ├── generate-index.js             # Blog index generator
│   ├── generate-feed.js              # RSS feed generator
│   └── generate-annotation-index.js  # Annotations index generator
└── README.md                  # This file
```

## Annotations Section

The website includes a dedicated annotations section for sharing insights and reflections on papers and books. This feature allows for capturing and displaying partial annotations and personal thoughts about academic and literary content with manual citation formatting.

### Metadata Structure

#### Paper Metadata
```json
ANNOTATION_META
{
  "title": "Paper Title",
  "date": "YYYY-MM-DD",
  "type": "paper",
  "authors": ["Author One", "Author Two"],
  "publication": "Journal/Conference Name",
  "year": 2024,
  "url": "https://example.com/paper.pdf",
  "tags": ["AI", "Security"],
  "topics": ["Neural Networks", "Cryptography"],
  "status": "annotated"
}
```

#### Book Metadata
```json
ANNOTATION_META
{
  "title": "Book Title",
  "date": "YYYY-MM-DD",
  "type": "book",
  "authors": ["Author Name"],
  "publisher": "Publisher Name",
  "year": 2023,
  "tags": ["Computer Science", "Philosophy"],
  "topics": ["Systems Design", "Problem Solving"],
  "status": "annotated",
  "chapters": ["Chapter 1", "Chapter 5"]  // Optional
}
```

### Content Structure

Each annotation contains:
- **Citation**: Manually formatted citation
- **Key Insights**: Main takeaways
- **Detailed Notes**: Optional section-by-section notes
- **Quotes**: Important passages with references
- **Personal Reflections**: Connections to other work, applications
- **References**: Citations to other papers/books mentioned

## Development Workflow

This site is automatically deployed to Cloudflare Pages when changes are pushed to the main branch of this repository.

### Adding a New Annotation

To add a new paper or book annotation:

1. **Create a new HTML file** from the appropriate template:
   ```bash
   # For a paper
   cp annotations/template-paper.html annotations/entries/YYYY-MM-DD-paper-title.html
   
   # For a book
   cp annotations/template-book.html annotations/entries/YYYY-MM-DD-book-title.html
   ```
   
   Naming convention: `YYYY-MM-DD-abbreviated-title.html`

2. **Add metadata** to the file by editing the comment block at the top:
   ```html
   <!--
   ANNOTATION_META
   {
     "title": "Your Paper/Book Title",
     "date": "YYYY-MM-DD",
     "type": "paper",
     "authors": ["Author One", "Author Two"],
     "publication": "Journal Name",
     "year": 2024,
     "url": "https://example.com/paper.pdf", 
     "tags": ["tag1", "tag2"],
     "topics": ["topic1", "topic2"],
     "status": "annotated"
   }
   END_ANNOTATION_META
   -->
   ```

3. **Write the citation** manually in the Citation section

4. **Reference PDFs** if needed:
   - Upload PDFs to `/assets/pdfs/`
   - Reference them using the URL path: `/assets/pdfs/your-file.pdf`
   - This works well in the URL field of annotation metadata

5. **Add your content** to the relevant sections:
   - Key Insights
   - Detailed Notes (optional)
   - Notable Quotes
   - Personal Reflections
   - Related References

6. **Generate the annotation index**:
   ```bash
   node tools/generate-annotation-index.js
   ```

7. **Commit and push** your changes to GitHub

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
- **Tag filtering** - Posts and annotations can be filtered by tags
- **Academic annotations** - Dedicated section for annotating papers and books with specialized metadata
- **Search functionality** - Full-text search across annotations
- **Filtering system** - Filter annotations by type, tags, topics, and year
- **Manual citations** - High-quality manual citation formatting
- **Self-initializing JavaScript** - Both blog.js and annotations.js handle functionality without dependencies
- **Cloudflare integration** - Cloudflare icon is automatically added next to mentions of "Cloudflare"
- **Auto-generated RSS feed** - Full content is available via RSS with properly converted image URLs
- **Favicon support** - Complete set of favicon and touch icons for all platforms
- **Responsive design** - Site works well on all device sizes

## Implementation Details

- The site uses vanilla JavaScript with no frameworks or libraries
- Blog posts are stored as individual HTML files with metadata in HTML comments
- Blog listing on the homepage uses a pre-generated JSON index file for better performance
- The blog.js script includes debug logs that can be viewed in the browser console

## Future Improvements

### Template-Based Structure

A planned improvement for the site's architecture is to implement a template-based structure:

1. **Base Template**: Create a single base HTML template that contains:
   - Common `<head>` elements (meta tags, CSS imports, favicon links)
   - Header with navigation
   - Footer
   - Common JavaScript imports

2. **Benefits**:
   - Consistent navigation and footer across all pages
   - Centralized updates to shared elements
   - Simplified creation of new page types
   - Better mobile menu functionality across the site

3. **Implementation Approach**:
   - Create a `templates/` directory with base template files
   - Develop a simple template engine or use a static site generator
   - Refactor existing pages to use the template system
   - Maintain the current vanilla JavaScript approach for dynamic content

This architecture will improve maintainability while preserving the site's minimalist and dependency-free approach.

## License

© 2025 Matt Rude. All rights reserved.