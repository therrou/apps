import { ChatCompletionRequestMessage } from 'openai';
import { findLineWithTextData, getContentFromParsedLine } from './aiHelpers';

/**
 * This class is used to interact with OpenAI's API.
 * Allowing us to create and manage a stream to the API, similar to openai's node package.
 * @param baseUrl string
 * @param apiKey string
 * @param model string
 */
class AI {
  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
    this.decoder = new TextDecoder('utf-8');
  }

  baseUrl: string;
  apiKey: string;
  model: string;
  decoder: TextDecoder;

  /**
   * This function creates and returns a stream to OpenAI's API.
   * @param payload ChatCompletionRequestMessage[]
   * @returns ReadableStreamDefaultReader<Uint8Array>
   */
  streamChatCompletion = async (payload: ChatCompletionRequestMessage[]) => {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      responseType: 'stream',
    };

    const body = JSON.stringify({
      model: this.model,
      messages: payload,
      stream: true,
    });

    const stream = (
      await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body,
      })
    ).body?.getReader();

    if (!stream) {
      throw new Error('Unable to create stream');
    }

    return stream;
  };

  /**
   * Use this function in a while loop to parse the stream returned from OpenAI's API.
   * This function will return false if the stream is done.
   * @param stream ReadableStreamDefaultReader<Uint8Array>
   * @returns string | false
   */
  parseStream = async (stream: ReadableStreamDefaultReader<Uint8Array>) => {
    const { done, value } = await stream.read();

    if (done) {
      return false;
    }

    const dataList = this.decoder.decode(value);
    const lines = dataList.split('data: ');

    const lineWithTextData = lines.find(findLineWithTextData);

    if (lineWithTextData) {
      const parsedLine = JSON.parse(lineWithTextData);
      const content = getContentFromParsedLine(parsedLine);

      return content;
    }

    return '';
  };

  /**
   * This function will send a stop signal to OpenAI's API.
   * @param stream ReadableStreamDefaultReader<Uint8Array> | null
   * @returns void
   */
  sendStopSignal = (stream: ReadableStreamDefaultReader<Uint8Array> | null) => {
    if (stream) {
      stream.cancel();
    }
  };
}

export default AI;
