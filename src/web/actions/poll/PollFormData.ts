/** Decode multipart representations without asserting that files or JSON have valid field types.
 * Request schemas validate these values before application commands are invoked. */
import { z } from 'zod';
import { normalizeFormText } from '../utils/normalizeFormText';

function formDate(value: FormDataEntryValue | null): Date | undefined {
  // A missing date is not midnight on 1970-01-01 (new Date(null)).
  return typeof value === 'string' ? new Date(value) : undefined;
}

function optionalText(value: FormDataEntryValue | null) {
  // Keep files as invalid input so an optional field cannot silently discard them.
  return value === null || (typeof value === 'string' && !value.trim())
    ? undefined
    : value;
}

function formJson(value: FormDataEntryValue | null): unknown {
  if (!value) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    // Keep malformed input for the array schema's field error.
    return value;
  }
}

export function readCreatePollForm(form: FormData) {
  return {
    title: form.get('title'),
    description: normalizeFormText(form.get('description')),
    organizationId: form.get('organizationId'),
    boardId: optionalText(form.get('boardId')) ?? null,
    startDate: formDate(form.get('startDate')),
    endDate: formDate(form.get('endDate')),
    distributionType: optionalText(form.get('distributionType')),
    propertyAggregation: optionalText(form.get('propertyAggregation')),
    propertyIds: formJson(form.get('propertyIds')),
    pollType: optionalText(form.get('pollType')),
    // FormData carries strings, and z.coerce.boolean() treats any non-empty
    // string as true — including "false". Compare explicitly.
    anonymous: form.get('anonymous') === 'true',
  };
}

export function readUpdatePollForm(form: FormData) {
  return {
    pollId: form.get('pollId'),
    title: form.get('title'),
    description: normalizeFormText(form.get('description')),
    startDate: formDate(form.get('startDate')),
    endDate: formDate(form.get('endDate')),
  };
}

export function readQuestionForm(form: FormData) {
  const answers = z.array(z.string()).safeParse(formJson(form.get('answers')));

  return {
    pollId: form.get('pollId'),
    text: form.get('text'),
    details: optionalText(form.get('details')),
    page: form.get('page'),
    order: form.get('order'),
    questionType: form.get('questionType'),
    // Invalid JSON retains the existing empty-answer validation outcome.
    answers: answers.success
      ? answers.data.filter((text) => text.trim()).map((text) => text.trim())
      : [],
  };
}
