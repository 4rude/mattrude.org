/**
 * blog.js - Blog functionality for mattrude.org
 * 
 * This module handles fetching blog posts from post-index.json,
 * rendering them on the homepage, and managing tag filtering.
 */

// Make the Blog object global so it can be accessed by main.js
window.Blog = {
  /**
   * Initialize blog functionality
   */
  init: function() {
    console.log('Initializing blog functionality');
    // Check if we're on a page with blog posts
    // Using optional chaining for cleaner code
    const postList = document.querySelector('.post-list');
    postList && this.loadPosts(postList);
    
    // Check if we're on an individual blog post page
    const blogPost = document.querySelector('.blog-post');
    blogPost && this.setupPostNavigation();
  },
  
  /**
   * Format a date string without timezone issues
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {string} Formatted date
   */
  formatDate: function(dateStr) {
    if (!dateStr) return 'Unknown date';
    
    // Parse the date manually to avoid timezone issues
    const dateComponents = dateStr.split('-');
    if (dateComponents.length === 3) {
      const year = dateComponents[0];
      const monthIndex = parseInt(dateComponents[1], 10) - 1; // JavaScript months are 0-indexed
      const day = parseInt(dateComponents[2], 10);
      
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      // Using nullish coalescing for safer access
      return `${months[monthIndex] ?? 'Unknown'} ${day ?? '??'}, ${year ?? '????'}`;
    } else {
      // Fallback for unexpected date formats
      try {
        const postDate = new Date(dateStr);
        return postDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        console.error('Error formatting date:', e);
        return dateStr; // Return the original string if all else fails
      }
    }
  },
  
  /**
   * Load posts from the index JSON file with pagination
   * @param {HTMLElement} container - Element to render posts into
   * @param {number} page - Page number to load (1-based)
   * @param {number} perPage - Number of posts per page
   */
  loadPosts: async function(container, page = 1, perPage = 10) {
    try {
      console.log(`Fetching blog posts page ${page}`);
      
      if (page === 1) {
        // First page, clear the container and add loading indicator
        container.innerHTML = '<div class="loading-placeholder">Loading posts...</div>';
      } else {
        // Add a loading indicator at the bottom for subsequent pages
        const loadingMore = document.createElement('div');
        loadingMore.className = 'loading-more';
        loadingMore.textContent = 'Loading more posts...';
        container.appendChild(loadingMore);
      }
      
      const response = await fetch('/blog/post-index.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load blog posts: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Loaded post data:', data);
      
      // Remove any loading indicators using optional chaining
      container.querySelector('.loading-placeholder')?.remove();
      container.querySelector('.loading-more')?.remove();
      
      // Calculate start and end indices for pagination
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const postsToRender = data.posts.slice(startIndex, endIndex);
      
      // Add posts to the container
      if (postsToRender.length > 0) {
        postsToRender.forEach(post => {
          this.renderPost(container, post);
        });
        
        // Set up tag filtering if this is the first page
        if (page === 1) {
          this.setupTagFiltering(data.posts);
        }
        
        // Set up infinite scroll if there are more posts
        if (endIndex < data.posts.length) {
          this.setupInfiniteScroll(container, page + 1, perPage, data.posts.length);
        }
      } else if (page === 1) {
        container.innerHTML = '<p>No blog posts found.</p>';
      }
      
    } catch (error) {
      console.error('Error loading blog posts:', error);
      container.innerHTML = '<p>Error loading blog posts. Please try again later.</p>';
    }
  },
  
  /**
   * Render a single blog post
   * @param {HTMLElement} container - Element to render the post into
   * @param {Object} post - Post data
   */
  renderPost: function(container, post) {
    console.log('Rendering post:', post.title);
    
    // Format the date without timezone conversion
    const formattedDate = this.formatDate(post.date);
    
    // Create the date HTML with optional edit date
    let dateHtml = `<span class="publish-date">${formattedDate}</span>`;
    if (post.edited && post.edited.trim()) {
      dateHtml += `
        <span class="edit-divider">·</span>
        <span class="edit-date">Edited: ${post.edited}</span>
      `;
    }
    
    // Create article element
    const article = document.createElement('article');
    article.className = 'post';
    // Using optional chaining for cleaner tag handling
    if (post.tags?.length) {
      article.dataset.tags = post.tags.join(',');
    }
    
    // Add a loading placeholder first
    article.innerHTML = `
      <h3><a href="/blog/posts/${post.file}">${post.title}</a></h3>
      <div class="post-meta">${dateHtml}</div>
      <div class="post-content-placeholder">Loading content...</div>
    `;
    
    // Add to container right away so we don't wait for fetch to complete
    container.appendChild(article);
    
    // Fetch the full post content
    fetch(`/blog/posts/${post.file}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load blog post: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        // Use DOM parser approach instead of regex
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find the post content div
        const postContentDiv = doc.querySelector('.post-content');
        let postContent = '';
        
        if (postContentDiv) {
          postContent = postContentDiv.innerHTML;
        } else {
          console.warn(`Could not find post content for: ${post.file}`);
          postContent = `<p>${post.description}</p>`;
        }
        
        // Update the placeholder with the full content - using optional chaining
        const placeholder = article.querySelector('.post-content-placeholder');
        if (placeholder) {
          const contentDiv = document.createElement('div');
          contentDiv.className = 'post-content';
          contentDiv.innerHTML = postContent;
          placeholder.parentNode?.replaceChild(contentDiv, placeholder);
        }
      })
      .catch(error => {
        console.error('Error loading full post content:', error);
        // Fallback to description if full content can't be loaded
        // Using optional chaining and nullish coalescing
        const placeholder = article.querySelector('.post-content-placeholder');
        if (placeholder) {
          placeholder.textContent = post.description ?? 'No content available';
        }
      });
  },
  
  /**
   * Set up tag filtering functionality
   * @param {Array} posts - Array of post objects
   */
  setupTagFiltering: function(posts) {
    console.log('Setting up tag filtering');
    const tagsContainer = document.querySelector('.tags-container');
    // Early return with clearer reason
    if (!tagsContainer) {
      return; // No tags container found
    }
    
    // Collect all unique tags
    const uniqueTags = new Set();
    posts.forEach(post => {
      // Using optional chaining with Array check
      if (Array.isArray(post.tags) && post.tags?.length) {
        post.tags.forEach(tag => uniqueTags.add(tag));
      }
    });
    
    console.log('Unique tags found:', Array.from(uniqueTags));
    
    // Clear existing tags
    tagsContainer.innerHTML = '';
    
    // Add "All Posts" button
    const allButton = document.createElement('button');
    allButton.className = 'tag active';
    allButton.textContent = 'All Posts';
    allButton.dataset.tag = 'all';
    allButton.addEventListener('click', () => this.filterPostsByTag('all'));
    tagsContainer.appendChild(allButton);
    
    // Add a button for each tag
    uniqueTags.forEach(tag => {
      const button = document.createElement('button');
      button.className = 'tag';
      button.textContent = tag;
      button.dataset.tag = tag;
      button.addEventListener('click', () => this.filterPostsByTag(tag));
      tagsContainer.appendChild(button);
    });
  },
  
  /**
   * Filter posts by tag
   * @param {string} tag - Tag to filter by, or 'all'
   */
  filterPostsByTag: function(tag) {
    console.log('Filtering posts by tag:', tag);
    // Update active state on tag buttons
    document.querySelectorAll('.tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === tag);
    });
    
    // Filter the posts
    document.querySelectorAll('.post').forEach(post => {
      if (tag === 'all') {
        post.style.display = 'block';
      } else {
        // Using nullish coalescing for default empty array
        const postTags = post.dataset.tags?.split(',') ?? [];
        post.style.display = postTags.includes(tag) ? 'block' : 'none';
      }
    });
  },
  
  /**
   * Set up infinite scroll functionality
   * @param {HTMLElement} container - Container element for posts
   * @param {number} nextPage - Next page number to load
   * @param {number} perPage - Posts per page
   * @param {number} totalPosts - Total number of posts
   */
  setupInfiniteScroll: function(container, nextPage, perPage, totalPosts) {
    console.log(`Setting up infinite scroll for page ${nextPage}`);
    
    // Function to check if we need to load more posts
    const checkScrollPosition = () => {
      // If we're near the bottom of the page and not already loading
      if (
        !this.isLoadingMore &&
        window.innerHeight + window.pageYOffset >= document.body.offsetHeight - 500
      ) {
        this.isLoadingMore = true;
        
        // Load the next page
        this.loadPosts(container, nextPage, perPage);
        
        // Update next page for future loading
        const nextEndIndex = nextPage * perPage;
        if (nextEndIndex < totalPosts) {
          nextPage++;
        } else {
          // No more posts, remove scroll listener
          window.removeEventListener('scroll', checkScrollPosition);
        }
        
        this.isLoadingMore = false;
      }
    };
    
    // Set initial state
    this.isLoadingMore = false;
    
    // Add scroll event listener
    window.addEventListener('scroll', checkScrollPosition);
  },
  
  /**
   * Set up navigation for individual blog posts
   */
  setupPostNavigation: async function() {
    try {
      console.log('Setting up post navigation');
      const response = await fetch('/blog/post-index.json');
      if (!response.ok) {
        throw new Error('Failed to load post navigation');
      }
      
      const data = await response.json();
      
      // Get current post filename from the URL
      const currentPath = window.location.pathname;
      const currentFile = currentPath.split('/').pop();
      
      // Find current post index
      const currentIndex = data.posts.findIndex(post => post.file === currentFile);
      if (currentIndex === -1) {
        return; // Current post not found
      }
      
      // Set up navigation links
      const navContainer = document.querySelector('.post-navigation');
      if (!navContainer) {
        return;
      }
      
      const prevLink = navContainer.querySelector('.prev-post');
      const nextLink = navContainer.querySelector('.next-post');
      
      // Previous post (newer) - using optional chaining
      if (currentIndex > 0) {
        const prevPost = data.posts[currentIndex - 1];
        prevLink?.insertAdjacentHTML('beforeend', `
          <a href="/blog/posts/${prevPost.file}">
            <span class="nav-label">Newer Post</span>
            <span class="nav-title">${prevPost.title}</span>
          </a>
        `);
      }
      
      // Next post (older) - using optional chaining
      if (currentIndex < data.posts.length - 1) {
        const nextPost = data.posts[currentIndex + 1];
        nextLink?.insertAdjacentHTML('beforeend', `
          <a href="/blog/posts/${nextPost.file}">
            <span class="nav-label">Older Post</span>
            <span class="nav-title">${nextPost.title}</span>
          </a>
        `);
      }
      
    } catch (error) {
      console.error('Error setting up post navigation:', error);
    }
  }
};

// Self-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Blog.js loaded, initializing...');
  window.Blog.init();
});

// Export for Node.js environment (for the generate-index.js script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.Blog;
}