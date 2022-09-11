import {
  Args,
  Mutation,
  Query,
  Resolver,
  Parent,
  ResolveField,
  Subscription,
} from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import Message from 'src/db/models/message.entity';
import User from 'src/db/models/user.entity';
import RepoService from 'src/repo.service';
import MessageInput, { DeleteMessageInput } from './input/message.input';

export const pubSub = new PubSub();

@Resolver(() => Message)
class MessageResolver {
  constructor(private readonly repoService: RepoService) {}

  //Querys são as pesquisas no banco (select)
  @Query(() => [Message])
  public async getMessages(): Promise<Message[]> {
    return this.repoService.messageRepo.find();
  }

  @Query(() => [Message])
  public async getMessagesFromUser(
    @Args('userId') userId: number,
  ): Promise<Message[]> {
    return this.repoService.messageRepo.find({ where: { userId } });
  }

  @Query(() => Message, { nullable: true })
  public async getMessage(@Args('id') id: number): Promise<Message> {
    return this.repoService.messageRepo.findOne({ where: { id } });
  }

  //Mutations são as mudanças no banco (criar, alterar e deletar)
  @Mutation(() => Message)
  public async createMessage(
    @Args('data') input: MessageInput,
  ): Promise<Message> {
    const message = this.repoService.messageRepo.create({
      userId: input.userId,
      content: input.content,
    });

    const response = await this.repoService.messageRepo.save(message);

    pubSub.publish('messageAdded', { messageAdded: message });

    return response;
  }

  @Mutation(() => Message)
  public async deleteMessage(
    @Args('data') input: DeleteMessageInput,
  ): Promise<Message> {
    const message = await this.repoService.messageRepo.findOne({
      where: { id: input.id },
    });

    if (!message || message.userId !== input.userId)
      throw new Error(`A mensagem não existe ou você não é o autor da mesma `);

    const copy = { ...message };

    await this.repoService.messageRepo.remove(message);

    return copy;
  }

  @Subscription(() => Message)
  public async messageAdded() {
    return pubSub.asyncIterator('messageAdded');
  }

  @ResolveField()
  public async user(@Parent() parent: Message): Promise<User> {
    return this.repoService.userRepo.findOne({ where: { id: parent.userId } });
  }
}
export default MessageResolver;
