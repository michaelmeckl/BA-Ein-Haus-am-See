const enum Priority {
  not_important,
  //optional,
  important,
  very_important,
}

const enum Distance {}
//TODO(not implemented)

export default interface osmTag {
  readonly key: string;
  // array with possible values for this key
  readonly values: string[];
  // if this tag is used currently
  selected: boolean;
  // the maximal (or minimal) distance it should be away
  distance: number; // as enum instead?
  // whether this tag is wanted or not (positive distance or negative!)
  wanted: boolean; //TODO besserer bezeichner (vllt. polarity?)
  //TODO priority: Priority;

  // eslint-disable-next-line semi
}