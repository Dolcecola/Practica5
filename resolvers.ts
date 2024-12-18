import { Collection, ObjectId } from "mongodb";
import {CommentModel, PostModel, UserModel} from "./tps.ts";

type context = {
    users: Collection<UserModel>,
    posts: Collection<PostModel>,
    comments: Collection<CommentModel>,
}

export const resolvers = {
    Query: {
        users: async(_: unknown, __: unknown, c: context): Promise<UserModel[]> => {
            return await c.users.find().toArray();  
        },

        user: async(_: unknown, args: {id: string}, c: context): Promise<UserModel | null> => {
          return await c.users.findOne(new ObjectId(args.id));  
        },

        posts: async(_: unknown, __: unknown, c: context): Promise<PostModel[]> => {
          return await c.posts.find().toArray();  
        },

        post: async(_: unknown, args: {id: string}, c: context): Promise<PostModel | null> => {
          return await c.posts.findOne(new ObjectId(args.id));
        },

        comments: async(_: unknown, __: unknown, c: context): Promise<CommentModel[]> => {
          return await c.comments.find().toArray();  
        },

        comment: async(_: unknown, args: {id: string}, c: context): Promise<CommentModel | null> => {
          return await c.comments.findOne(new ObjectId(args.id));
        },
    },

    Mutation: {
      createUser: async (_: unknown, args: { input: { name: string, password: string, email: string } }, c: context): Promise<UserModel> => {
        const { name, email, password } = args.input;

        const existingUser = await c.users.findOne({ email });
        if (existingUser) {
          throw new Error("Email already exists. Please use a different email.");
        }

        const newPassword = password.split("").reverse().map((char, index) => String.fromCharCode(char.charCodeAt(0) + index + 1)).join("");
  
        const newUser: UserModel = {
          name,
          email,
          password: newPassword,
          posts: [], 
          comments: [],
          likedPosts: [], 
        };
  
        await c.users.insertOne(newUser);
        return newUser;
      },

      updateUser: async (_: unknown, args: { id: string, input: { name: string, password: string, email: string } }, c: context): Promise<UserModel> => {
        const { id, input } = args;

        if (input.password) {
          const newPassword = input.password
            .split("")
            .reverse()
            .map((char, index) => String.fromCharCode(char.charCodeAt(0) + index + 1))
            .join("");
      
          input.password = newPassword; 
        }
  
        await c.users.updateOne(
          { _id: new ObjectId(id) },
          { $set: input },
        );
  
        const updatedDocument = await c.users.findOne({ _id: new ObjectId(id) });

        if (!updatedDocument) {
          throw new Error("Document not found after update");
        }

        return updatedDocument;
      },
  
      deleteUser: async (_: unknown, args: { id: string }, c: context): Promise<boolean> => {
        const result = await c.users.deleteOne({ _id: new ObjectId(args.id) });
        return result.deletedCount === 1;
      },
  
      createPost: async (_: unknown, args: { input: { content: string, authorId: string } }, c: context): Promise<PostModel> => {
        const { content, authorId } = args.input;
  
        const author = await c.users.findOne({ _id: new ObjectId(authorId) });
        if (!author) {
          throw new Error(`Author with ID ${authorId} not found`);
        }
  
        const newPost: PostModel = {
          content,
          author: new ObjectId(authorId),
          comments: [],
          likes: [],
        };
  
        const result = await c.posts.insertOne(newPost);
        return { ...newPost, _id: result.insertedId };
      },
  
      updatePost: async (_: unknown, args: { id: string, input: { content: string } }, c: context): Promise<PostModel> => {
        const { id, input } = args;
  
        await c.posts.updateOne(
          { _id: new ObjectId(id) },
          { $set: input }
        );
      
        const updatedPost = await c.posts.findOne({ _id: new ObjectId(id) });
      
        if (!updatedPost) {
          throw new Error("Post not found after update");
        }
      
        return updatedPost;
      },
  
      deletePost: async (_: unknown, args: { id: string }, c: context): Promise<boolean> => {
        const result = await c.posts.deleteOne({ _id: new ObjectId(args.id) });
        return result.deletedCount === 1;
      },
  
      addLikeToPost: async (_: unknown, args: { postId: string, userId: string }, c: context): Promise<PostModel> => {
        const { postId, userId } = args;
  
        const post = await c.posts.findOne({ _id: new ObjectId(postId) });
        const user = await c.users.findOne({ _id: new ObjectId(userId) });
  
        if (!post || !user) {
          throw new Error("Post or User not found");
        }
  
        await c.posts.updateOne(
          { _id: new ObjectId(postId) },
          { $addToSet: { likes: new ObjectId(userId) } }
        );
  
        return { ...post, likes: [...post.likes, new ObjectId(userId)] };
      },
  
      removeLikeFromPost: async (_: unknown, args: { postId: string, userId: string }, c: context): Promise<PostModel> => {
        const { postId, userId } = args;
  
        const post = await c.posts.findOne({ _id: new ObjectId(postId) });
        if (!post) {
          throw new Error(`Post with ID ${postId} not found`);
        }
  
        await c.posts.updateOne(
          { _id: new ObjectId(postId) },
          { $pull: { likes: new ObjectId(userId) } }
        );
  
        return { ...post, likes: post.likes.filter((like) => !like.equals(new ObjectId(userId))) };
      },
  
      createComment: async (_: unknown, args: { input: { text: string, authorId: string, postId: string } }, c: context): Promise<CommentModel> => {
        const { text, authorId, postId } = args.input;
  
        const author = await c.users.findOne({ _id: new ObjectId(authorId) });
        const post = await c.posts.findOne({ _id: new ObjectId(postId) });
  
        if (!author || !post) {
          throw new Error("Author or Post not found");
        }
  
        const newComment: CommentModel = {
          text,
          author: new ObjectId(authorId),
          post: new ObjectId(postId),
        };
  
        const result = await c.comments.insertOne(newComment);
  
        await c.posts.updateOne(
          { _id: new ObjectId(postId) },
          { $push: { comments: result.insertedId } }
        );
  
        return { ...newComment, _id: result.insertedId };
      },
  
      updateComment: async (_: unknown, args: { id: string, input: { text: string } }, c: context): Promise<CommentModel> => {
        const { id, input } = args;
  
        await c.comments.updateOne(
          { _id: new ObjectId(id) },
          { $set: input }
        );
      
        const updatedComment = await c.comments.findOne({ _id: new ObjectId(id) });
      
        if (!updatedComment) {
          throw new Error("Comment not found after update");
        }
      
        return updatedComment;
      },
  
      deleteComment: async (_: unknown, args: { id: string }, c: context): Promise<boolean> => {
        const result = await c.comments.deleteOne({ _id: new ObjectId(args.id) });
        return result.deletedCount === 1;
      },
    },

    User: {
        id: (parent: UserModel, _: unknown):string => {
            return parent._id!.toString();
        },

        posts: async(parent: UserModel, _: unknown, c: context): Promise<PostModel[]> => {
            const ids = parent.posts;// Devuelve el campo posts de UserModel (el parent)
            const post = await c.posts.find({_id: {$in: ids}}).toArray();
            return post;
        },

        comments: async(parent: UserModel, _: unknown, c: context): Promise<CommentModel[]> => {
            const ids = parent.comments;
            const comm = await c.comments.find({_id: {$in: ids}}).toArray();
            return comm;
        },

        likedPosts: async(parent: UserModel, _: unknown, c: context): Promise<PostModel[]> => {
            const ids = parent.likedPosts;
            const post = await c.posts.find({_id: {$in: ids}}).toArray();
            return post;
        },
    },

    Post: {
        id: (parent: PostModel): string => parent._id!.toString(),
    
        author: async (
          parent: PostModel, _: unknown, c: context): Promise<UserModel> => {
            const author = await c.users.findOne({ _id: parent.author });
            if (!author) {
              throw new Error(`Author with ID ${parent.author} not found`);
          }
            return author;
        },
    
        comments: async (
          parent: PostModel, _: unknown, c: context): Promise<CommentModel[]> => {
          const ids = parent.comments;
          return await c.comments.find({ _id: { $in: ids } }).toArray();
        },
    
        likes: async (
          parent: PostModel, _: unknown, c: context): Promise<UserModel[]> => {
          const ids = parent.likes;
          return await c.users.find({ _id: { $in: ids } }).toArray();
        },
      },
    
      Comment: {
        id: (parent: CommentModel): string => parent._id!.toString(),
    
        author: async (parent: CommentModel, _: unknown, c: context): Promise<UserModel> => {
          const author = await c.users.findOne({ _id: parent.author });
          if (!author) {
              throw new Error(`Author with ID ${parent.author} not found`);
          }
          return author;
      },

      post: async (parent: CommentModel, _: unknown, c: context): Promise<PostModel> => {
          const post = await c.posts.findOne({ _id: parent.post });
          if (!post) {
              throw new Error(`Post with ID ${parent.post} not found`);
          }
          return post;
      },
    },
}