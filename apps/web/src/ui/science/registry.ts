import { SCIENCE_BINDINGS, SCIENCE_TOPICS, type ScienceTopicId } from '@astrix/data';
export function isScienceTopicId(id:string):id is ScienceTopicId { return Object.hasOwn(SCIENCE_TOPICS,id); }
export function topicForContext(context:string):ScienceTopicId {
  const topic=SCIENCE_BINDINGS[context]?.[0];
  if(!topic)throw new Error(`Missing scientific context binding: ${context}`);
  return topic;
}
export function scienceTopic(id:string) {
  if(!isScienceTopicId(id))throw new Error(`Missing scientific topic: ${id}`);
  return SCIENCE_TOPICS[id];
}
